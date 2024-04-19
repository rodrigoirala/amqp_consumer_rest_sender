const {brokerApi} = require( "./services/broker_amqp");

class BrokerFactory {

  constructor() {
    this.instance = null;
    this.connectionsFns = {};
  }

  static getInstance( ) {
    if (!this.instance) {
      this.instance = new BrokerFactory();
    }

    return this.instance;
  }

  init( servicesData ){
    ``
    const serviceNames = Object.keys( servicesData);

    try{
      this.connectionsFns = serviceNames.reduce( ( pValue, sName) =>{
          const connectionFunction = brokerApi.getConnection( servicesData[sName].hostURL, servicesData[sName].user, servicesData[sName].pass);
          return {...pValue, [sName]: connectionFunction};
      }, {});
    } catch ( e ){
      console.log("Error getting broker connection");
      throw e;
    } 
  }

  getBrokerConnection( sName){
    return this.connectionsFns[sName];
  }
}

module.exports = BrokerFactory.getInstance();