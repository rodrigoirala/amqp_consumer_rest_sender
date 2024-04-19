const Ajv = require('ajv');
const customRegex = require('./regex'); 

let ajv = new Ajv({ removeAdditional: true });

const serviceSchema = {
  type: "object",
  additionalProperties: false,
  properties:{
    senderType: { enum: ['singleEndpoint', 'multipleEndpoint'] },
    serviceBroker: { type: "string", default: ""},
    retrieveQueueName: { type: "string", default: ""},
    authHeadersEndpoint: { type: "string", default: "", pattern: customRegex.http_resource.source },
    sendEndpoint: { type: "string", default: "", pattern: customRegex.http_resource.source },
    baseURL: { type: "string", default: "", pattern: customRegex.http_resource.source },
    exclusive: { type: "boolean", default: false},
    sendMethod: { enum: ['post', 'get', 'patch', 'update', 'delete'] },
    requeue: { type: "object", default: {}},
  },
  required: [ 
    'senderType',
    'serviceBroker',
    'retrieveQueueName',
    'authHeadersEndpoint',
    'requeue'
  ]
};

const requeueSchema = {
  type: "object",
  additionalProperties: false,
  properties:{
    hasToRequeue: { type: "boolean", default: false},
    messagePortion: { type: "string", default: ""},
    defaultExchangeQueue: { type: "object", default: {}},
    exchangesRoutes: { type: "array", default: []}
  },
  required: [ 
    'hasToRequeue',
    'messagePortion',
    'defaultExchangeQueue',
    'exchangesRoutes'
  ]
};

const routeSchema = {
  type: "object",
  additionalProperties: false,
  properties:{
    statusBegin: { type: "integer", default: 0},
    statusEnd: { type: "integer", default: 0},
    messagePortion: { type: "string", default: ""},
    messagePortionExtra: { type: "object", default: {}},
    exchangeName: { type: "string", default: ""},
    queues: { type: "array", default: []},
  },
  required: [ 
    'statusBegin',
    'statusEnd',
    'exchangeName',
    'queues'
  ]
};

let serviceValidator = ajv.compile( serviceSchema );
let requeueValidator = ajv.compile( requeueSchema );
let routeValidator = ajv.compile( routeSchema );


module.exports = {
  serviceSpecsValidator: serviceValidator,
  requeueSpecsValidator: requeueValidator,
  routeSpecsValidator: routeValidator
};
