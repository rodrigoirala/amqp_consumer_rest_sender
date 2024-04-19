
require('process');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const config = require('config');
const { brokerApi } = require('../services/broker_amqp/index');
const queueName = process.env.QUEUE_KEY;

const onMessageArrive =  () => async ( bufMessage ) => {

  /*If the consumer is cancelled by RabbitMQ, the message callback will be invoked with null.*/
  if (!bufMessage.content) {
    return;
  }

  const entireMsg = JSON.parse( bufMessage.content.toString());
  let msg = entireMsg;
  const msgPortions = config.requeuer[queueName].sourcePortionToRepublish.split('.');
  msg = msgPortions.reduce((accumulator, currentValue)  => {
    //en caso que la clave anidada de la respuesta o el error no exista se devuelve el mismo valor
    return accumulator[currentValue] || accumulator }, 
    entireMsg);
  try{
    console.log("Republishing messsage");
    console.log( msg );
    const repubilshed = await brokerApi.publish( config.requeuer[queueName].exchangeToRequeue)( msg );
    ( repubilshed ? brokerApi.getChannel().ack( bufMessage ) 
            : brokerApi.getChannel().nack( bufMessage ));
  } catch ( e ){
    console.log("Error al republicar mensaje");
    console.log(e);
  } 
}

const start = async () => {

  console.log('Requeuer is running on ' + process.env.NODE_ENV + ' mode');
  const requesServices = config.requeuer[queueName];
  console.log('Requeue queues');
  console.log(queueName);

  const brokerFc = require('../BrokerFactory');
  brokerFc.init(config.servicesBrokers);

  const brokerConFn = brokerFc.getBrokerConnection( requesServices.serviceBroker );
  try{
    await brokerApi.initChannel( await brokerConFn());
  } catch ( e ) {
    console.log("Error in channel initialization. Error: " + e.message );
    return;
  }

  const consumerFn = brokerApi.consume(
    onMessageArrive(),
    queueName,
    true
  );
  consumerFn();
}

start();

module.exports = {
  script: 'email-notificator.js'
}

