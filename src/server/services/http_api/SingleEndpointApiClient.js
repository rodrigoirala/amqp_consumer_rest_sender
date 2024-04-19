const { ApiClient } = require('./ApiClient');

class SingleEndpointApiClient extends ApiClient {
  constructor( axiosOptions ) {
    super( axiosOptions );
  }

  getRequest = ( method, url ) => async( bodyData = {}, qryParams = {}, pathParams = {}) => {

    let urlWithParams = url;
    Object.entries( pathParams || {}).forEach(([
        k,
        v,
    ]) => {
      urlWithParams = urlWithParams.replace( k, encodeURIComponent(v));
    });

    const options = {
      method,
      url: urlWithParams,
      params: qryParams,
      data: bodyData
    };
  
    return this.httpClient(options);
  }
}

module.exports = { SingleEndpointApiClient };
