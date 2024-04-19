
require('process');
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const config = require('config');
const { brokerApi } = require('../services/broker_amqp/index');

let transporter = null;

const onMessageArrive =  (subject, emails) => async ( bufMessage ) => {

  /*If the consumer is cancelled by RabbitMQ, the message callback will be invoked with null.*/
  if (!bufMessage.content) {
    return;
  }

  const msg = JSON.parse( bufMessage.content.toString());
  const sentEmail = await notifyErrorByEmail( msg, emails, subject);
  //le indica al server que no se tomó el mensaje. Por defecto rabbitqm lo vuelve a encolar.
  ( sentEmail ? brokerApi.getChannel().ack( bufMessage ) 
            : brokerApi.getChannel().nack( bufMessage ));
}

async function notifyErrorByEmail( msg, emails, subject ){
  
  try{
    let info = await transporter.sendMail({
        from: config.emailNotifications.email.from, // sender address
        to: emails, // list of receivers
        subject: subject, // Subject line
        text: Buffer.from( JSON.stringify( msg), 'utf8'), // plain text body
        html: "<b>"+ Buffer.from( JSON.stringify( msg), 'utf8') +"</b>", // html body
      });
    console.log("Message sent: %s", info.messageId);
    return true;
  } catch ( error ) {
    console.log('Sending email error occurred ');
    console.log(error.message);
    return false;
  }
}

const start = async () => {
  const nodemailer = require("nodemailer");

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: config.emailNotifications.email.user,
      pass: config.emailNotifications.email.pass
    },
  });

  console.log('Email notificator running on ' + process.env.NODE_ENV + ' mode');
  const queueName = process.env.QUEUE_KEY;
  const emailQueues = config.emailNotifications.queues;
  console.log('Email queues');
  console.log(emailQueues);

  const brokerFc = require('../BrokerFactory');
  brokerFc.init(config.servicesBrokers);
  const selectedQueue = emailQueues[queueName];
  console.log('Selected queue: ' + queueName);
  console.log(selectedQueue);

  const brokerConFn = brokerFc.getBrokerConnection( selectedQueue.serviceBroker );
  try{
    await brokerApi.initChannel( await brokerConFn());
  } catch ( e ) {
    console.log("Error in channel initialization. Error: " + e.message );
    return;
  }
  
  const subject = selectedQueue.subject;
  const emails = selectedQueue.emails;

  const consumerFn = brokerApi.consume(
    onMessageArrive( subject, emails),
    queueName,
    true
  );
  consumerFn();
}

start();

module.exports = {
  script: 'email-notificator.js'
}

