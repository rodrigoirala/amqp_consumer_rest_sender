const axios = require('axios');
const { ApiError } = require('./ApiError');

class ApiClient {
  constructor( axiosOptions ) {

    this.name = this.constructor.name;
    this.httpClient = this.createClient( axiosOptions )
  }

  createClient( options = null ){
  
    this.httpClient = axios.create( options );
    this.httpClient.interceptors.response.use(
      response => response,
      async ( error ) => {
        const { config: config, response = {} } = error;
        const rData = response.data;
        const errorData = {
          status: response.status,
          data: {
            rData,
            errors: rData && rData.errors ? rData.errors : this.generalError,
          },
        };
    
        return this.throwApiError(errorData);
      },
    );
    return this.httpClient;
  }

  throwApiError = ({ data = {}, status = 500 }) => {
    console.error('API: Error Ocurred', status, data); //eslint-disable-line
    throw new ApiError(data, status);
  }

  generalError = {
    _global: ['Unexpected Error Occurred'],
  }

  getRequest = () => async( ) => {
    //todo: throw error on calling entering
  }
}

module.exports = { ApiClient };
