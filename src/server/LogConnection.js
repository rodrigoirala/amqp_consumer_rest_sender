const { MongoClient } = require('mongodb');
const config = require('config');
const mongoClient = new MongoClient( config.logDatabase.url );

const logConnection = null; 

async function getConnection(){
  if ( !logConnection ){
    try{
      await mongoClient.connect();
      const db = await mongoClient.db( config.logDatabase.database );
      await db.command({ ping: 1 });
      return db;
    } catch( e ){
      throw e;
    }
  } else {
    return logConnection;
  }
}

module.exports = getConnection;
