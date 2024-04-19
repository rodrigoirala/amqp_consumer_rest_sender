const brokerFc = require('./BrokerFactory');
const config = require('config');
const { brokerApi, publish } = require('./services/broker_amqp/index');

function getRoutes( serviceName, httpRequeueData, statusCode){

  const routes = { exchangeName: null, 
    messagePortion: "all", 
    queues: [], 
    messagePortionExtra: { "messagePortionExtra": {
      "setResponseAsBody": false, 
      "includeTracking": false,
      "includeStatus": false
      }}
  };
  const exchanges = httpRequeueData["exchangesRoutes"];
  for( const ex of exchanges ){
    if ( statusCode >= ex.statusBegin && statusCode < ex.statusEnd ){
      routes.exchangeName = ex.exchangeName;
      routes.messagePortion = ex.messagePortion || httpRequeueData["messagePortion"] || routes.messagePortion;
      routes.messagePortionExtra = ex.messagePortionExtra || httpRequeueData["messagePortionExtra"] || routes.messagePortionExtra;
      routes.queues = ex.queues;
      break;
    }
  }

  if (routes.queues.length === 0 && httpRequeueData["defaultExchangeQueue"]) {
    routes.exchangeName = [serviceName,"default"].join("-");
    routes.messagePortion = httpRequeueData["messagePortion"] || routes.messagePortion;
    routes.messagePortionExtra = httpRequeueData["messagePortionExtra"] || routes.messagePortionExtra;
    routes.queues.push( httpRequeueData["defaultExchangeQueue"]);
  }

  return routes;
}

async function requeueMessage( msg, serviceName, exchangeName, queues){

  try{
    const brokerCon = brokerFc.getBrokerConnection( config.services[serviceName].serviceBroker );
    await brokerApi.initChannel( brokerCon );
    await brokerApi.bindExchangeQueues(exchangeName, queues)();
    return await brokerApi.publish( exchangeName)( msg );
  } catch ( e ){
    //retrun 0 to indicate that was an error on publish, in any other case publish returns a postive value
    return 0;
  } 
}

const handleHttpStatus = ( serviceName ) => async ( msgResponse ) => {
  
  const httpRequeueData = config.services[serviceName]["requeue"];
  if ( !httpRequeueData.hasToRequeue ){
    return true;
  }
  
  const { error: msgResponseError, response: msgResponseResp } = msgResponse;
  const statusCode = ( msgResponseError ? msgResponseError.status: (msgResponseResp ? msgResponseResp.status: 100));
  const routes = getRoutes( serviceName, httpRequeueData, statusCode );
  if ( !routes.queues ) {
    console.log("is not a requeue set for " + serviceName);
    return false;
  }

  /*The main posibles values for routes.messagePortion are: [all, origin, response, error]*/ 
  const msgPortions = routes.messagePortion.split('.');
  if ( !["all", "origin", "response", "error"].includes( msgPortions[0])) {
    console.log("is not a valid option for 'messagePortion' set for " + serviceName);
    return false;
  }

  let msg = msgResponse;
  if ( ["response", "error"].includes( msgPortions[0])) {
    msg = msgPortions.reduce((accumulator, currentValue)  => {
      //en caso que la clave anidada de la respuesta o el error no exista se devuelve el mismo valor
      return accumulator[currentValue] || accumulator }, 
    msgResponse);

    if (routes.messagePortionExtra 
    && routes.messagePortionExtra.setAsBodyResponse){
      
      msg = {body:{response: msg}};
      if (routes.messagePortionExtra.includeTracking){
        msg.body["tracking"] = msgResponse.response.tracking || {};
      }
      if (routes.messagePortionExtra.includeStatus){
        msg.body["status"] = msgResponse.response.status || {};
      }
    }
  }

  if ( ["origin"].includes( msgPortions[0])) {
    msg = msgResponse.origin;
  }

  const pubStatus = await requeueMessage( msg, serviceName, routes.exchangeName , routes.queues);
  
  return !!pubStatus;
}

module.exports = handleHttpStatus;