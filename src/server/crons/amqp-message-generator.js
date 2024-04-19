
require('process');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const config = require('config');
const { brokerApi } = require('../services/broker_amqp/index');
const serviceKey = process.env.SERVICE_KEY;

const start = async () => {

  console.log('Ids Estudios Generator is running on ' + process.env.NODE_ENV + ' mode');
  const services = config.amqpMessageGenerator[serviceKey];
  console.log('Service key');
  console.log(serviceKey);

  const brokerFc = require('../BrokerFactory');
  brokerFc.init(config.servicesBrokers);

  const brokerConFn = brokerFc.getBrokerConnection( services.serviceBroker );
  let channel = null;
  try{
    channel = await brokerApi.initChannel( await brokerConFn());
  } catch ( e ) {
    console.log("Error in channel initialization. Error: " + e.message );
    return;
  }

  try{
    console.log("Republishing messsages");
    const ids = [
      1,
      2];

    let msg = {};
    for(const id of ids){
      msg = {"body": {"id": id}};
      console.log( msg );
      const republished = await brokerApi.publish( config.amqpMessageGenerator[serviceKey].exchangeToRequeue)( msg );
      console.log( republished );
    }
    channel.close();
  } catch ( e ){
    console.log("Error al republicar mensaje");
    console.log(e);
  } 
}

start();

module.exports = {
  script: 'amqp-message-generator.js'
}

