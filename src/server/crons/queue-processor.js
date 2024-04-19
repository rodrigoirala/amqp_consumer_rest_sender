require('process');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const { brokerApi } = require('../services/broker_amqp/index');
const brokerFc = require('../BrokerFactory');
const aRetry = require('async-retry');
const config = require('config');
const logDB = require("../LogConnection");
const handleHttpStatus = require("../Requeueer");
const { SingleEndpointApiClient, MultipleEndpointApiClient, ApiError, ApiClient } = require('../services/http_api/');
const {serviceSpecsValidator, requeueSpecsValidator, routeSpecsValidator} = require('../validators');

let apiClient = null;
let authClient = null;
let apiClientOptions = null;

const onMessageArriveFn = ( httpReqFn, authHeaderFn, httpStatusHandlerFn) => async ( bufMessage ) => {

  /*If the consumer is cancelled by RabbitMQ, the message callback will be invoked with null.*/
  if (!bufMessage.content) {
    return;
  }

  const msg = JSON.parse( bufMessage.content.toString());
  let msgResponse = { origin: msg, response: null, error: null};
  const msgBody = msg.body || null;
  const msgQueryParams = ( msg.params && msg.params.query ? msg.params.query: null);
  const msgPathParams = ( msg.params && msg.params.path ? msg.params.path: null);
  const msgTracking = msg.tracking || {};
  const path = msg.path || null;
  const method = msg.method || null;
  let requestColName =  "responses";

  try{

    msgResponse.response = await aRetry(
      async (bail) => {
        try{
          const res = await httpReqFn( msgBody, msgQueryParams, msgPathParams, method, path);
          return {"status": res.status, "body": res.data, "tracking": msgTracking};
        } catch ( e ){
          if (e.status == 401 || e.status == 403) {
            try{
              const authHeaders = await authHeaderFn( true );
              apiClientOptions["headers"] = authHeaders.data.authHeaders;
              apiClient.createClient( apiClientOptions );
            } catch( e ){ 
              //in case of error getting token avoid the backoff retry
              bail( e );
            } 
            throw e;
          }
          if (e.status != 408 && e.status != 504) {
            //in case of non timeout related error avoid the backoff retry
            bail( e );
          } else {
            throw e;
          }
        }
      },
      {retries: 3}
    );    
  } catch( e ){

    msgResponse.error = {...e, "tracking": msgTracking};
    requestColName = "wrong_responses";
  }

  try{
    const dbCon = await logDB();
    const requestCol = dbCon.collection( requestColName );
    requestCol.insertOne( msgResponse );
    const requeueStatus = await httpStatusHandlerFn( msgResponse );
    const chan = brokerApi.getChannel();
    ( requeueStatus ? chan.ack( bufMessage ): chan.nack( bufMessage ));
  } catch( err ) {
    throw err;
  }
}

const getAuthHeaders = ( service ) => async ( renew = false) => {

  const renewQuery = (renew ? ["?", "renew=true"].join(""): ""); 
  try{
    return await authClient.getRequest( 'get', config.services[service].authHeadersEndpoint + renewQuery)();
  } catch ( e ) {
    console.log("Error getting auth headers \n" );
    console.log( e );
    throw e;
  }
}

const validateConfig = ( service )=>{

  let valid = serviceSpecsValidator(config.services[service]);

  if (!valid){
    console.log('Service configuration malformed');
    console.log( serviceSpecsValidator.errors );
    return false;
  }

  valid = requeueSpecsValidator(config.services[service].requeue);
  if (!valid){
    console.log('Requeue configuration malformed');
    console.log( requeueSpecsValidator.errors );
    return false;
  }

  for( const route of  config.services[service].requeue.exchangesRoutes){
    valid = routeSpecsValidator(route);
    if (!valid){
      console.log('Exchanges Routes configuration malformed');
      console.log( routeSpecsValidator.errors );
      return false;
    }
  }

  return true;
}

const start = async () => {

  brokerFc.init(config.servicesBrokers);
  const service = process.env.SERVICE_KEY;

  const brokerConFn  = brokerFc.getBrokerConnection( config.services[service].serviceBroker );
  try{
    await brokerApi.initChannel( await brokerConFn());
  } catch ( e ) {
    console.log("Error in channel initialization \n" );
    console.log( e );
    return;
  }
  
  authClient = new SingleEndpointApiClient( {responseType: 'json'});
  const authHeadersFn = getAuthHeaders( service );

  apiClientOptions = {
    responseType: 'json', 
    withCredentials: true, 
  };

  try{
    const authHeaders = await authHeadersFn();
    apiClientOptions["headers"] = authHeaders.data.authHeaders;
  } catch ( e ) {
    console.log("Error getting auth headers \n");
    console.log( e );
    return;
  }

  if ( !validateConfig( service )) {
    process.exit(9)
  }

  let httpReqFn = null;

  if ( config.services[service].senderType === "multipleEndpoint" ){

    apiClientOptions["baseURL"]= config.services[service].baseURL;
    apiClient = new MultipleEndpointApiClient( apiClientOptions);
    httpReqFn = apiClient.getRequest();
  } 

  if ( config.services[service].senderType === "singleEndpoint" ){
    
    apiClient = new SingleEndpointApiClient( apiClientOptions);
    httpReqFn = apiClient.getRequest(  
      config.services[service].sendMethod || 'post', 
      config.services[service].sendEndpoint );
  }

  const httpStatusHandlerFn = handleHttpStatus( service );
  const messageQueue = config.services[service].retrieveQueueName;

  const consumerFn = brokerApi.consume(
    onMessageArriveFn( httpReqFn, authHeadersFn, httpStatusHandlerFn),
    messageQueue,
    config.services[service].exclusive || true
  );
  consumerFn();
}

start();

module.exports = {
  script: 'queue-procesor.js'
}

