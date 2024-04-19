const { ApiClient } = require('./ApiClient');

class MultipleEndpointApiClient extends ApiClient {
  constructor( axiosOptions ) {
    super( axiosOptions );
  }

  getRequest = () => async( bodyData = {}, qryParams = {}, pathParams = {}, method, path ) => {


    let urlWithParams = path;
    Object.entries( pathParams || {}).forEach(([
        k,
        v,
    ]) => {
      urlWithParams = urlWithParams.replace( ":"+k, encodeURIComponent(v));
    });

    const options = {
      method: method,
      url: urlWithParams,
      params: qryParams,
      data: bodyData
    };
  
    return this.httpClient(options);
  }
}

module.exports = { MultipleEndpointApiClient };
