const amqp = require('amqplib');

let amqpChannel = null;

const getConnection =  (host, user, pass) => async () => {
  try{
    const opt = { credentials: amqp.credentials.plain( user, pass) };
    return await amqp.connect( host, opt);
  }catch (e) {
    console.log("Error setting the connection to " + host + " \n");
    console.log( e );
    throw e;
  }
}

async function initChannel( con ){
  try{
    if ( !amqpChannel ){
      amqpChannel = await con.createChannel();
    }
    
    return amqpChannel;
  }catch (e) {
    console.log("Invalid AMPQ connection \n");
    console.log( e);
    throw e;
  }
}

function getChannel(){
  return amqpChannel;
}

function getNewChannel( con ){
  return con.createChannel();
}

const publish = ( exchangeName ) => async ( message ) => {

  try{
  
    const buffMsg = new Buffer.from( JSON.stringify( message));
    return await amqpChannel.publish( exchangeName, '', buffMsg); //return true/false
  } catch ( e ) {
    console.log(e);
    return false;
  }
};

const bindExchangeQueues = ( exchangeName, queues) => async () => {

  try{
    await amqpChannel.assertExchange( exchangeName, "fanout", {
      durable: true
    });

    for( const exR of queues){
      await amqpChannel.assertQueue( exR.name, exR.options);
      await amqpChannel.bindQueue( exR.name, exchangeName, "");
    }
  } catch ( e ) {
    console.log("Error binding exchange and queues \n");
    console.log( e );
    return false;
  }
}

const consume = ( consumeFunction, queueName = suscribeQueueName, isExclusive ) => async () => {

  try {
    await amqpChannel.assertQueue( queueName, {
      durable: true
    });
   
    amqpChannel.prefetch(1);
    amqpChannel.consume( queueName, consumeFunction, {
      exclusive: isExclusive
    });
  } catch ( e ) {
    throw e;
  } 
};

const brokerApi = {
  publish: publish,
  consume: consume,
  initChannel: initChannel,
  getChannel: getChannel,
  getConnection: getConnection,
  getNewChannel: getNewChannel,
  bindExchangeQueues: bindExchangeQueues
};

module.exports = {brokerApi, publish, consume};
