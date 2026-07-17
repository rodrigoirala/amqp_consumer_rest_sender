# AMQP to Rest

An AMQP Consumer that gets the structured content of messages in a queue, gets the authorization headers from configured endpoints, send the messages to configured REST API endpoints and re-queue the response on configured queue depending of received status code. 

It works very well with https://github.com/rodrigoirala/http_auth_header_generator to get the authentication header for HTTP requests.
