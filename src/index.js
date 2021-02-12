const http = require('http');
const { ApolloServer, gql, PubSub, introspectSchema, makeRemoteExecutableSchema } = require('apollo-server-express');
const express = require('express');
const { ApolloLink, from, split } = require('apollo-link');
const { HttpLink } = require('apollo-link-http');
const { WebSocketLink } = require('apollo-link-ws');
const fetch = require('node-fetch');
const { getMainDefinition } = require('apollo-utilities');
const ws = require('ws');

const typeDefs = gql`
  type Query {
    hello: String
  }

  type Subscription {
    colour: String
  }
`;

const resolvers = {
  Query: {
    hello: () => 'Hello world!',
  },
  Subscription: {
    colour: {
      subscribe: () => {
        throw 'Error';
      },
    },
  },
};

const app1 = express();
const server1 = new ApolloServer({
  typeDefs,
  resolvers,
});
server1.applyMiddleware({ app: app1 });
const httpServer1 = http.createServer(app1);
server1.installSubscriptionHandlers(httpServer1);
const PORT1 = 4000;
httpServer1.listen(4000, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT1}${server1.graphqlPath}`);
  console.log(`🚀 Subscriptions ready at ws://localhost:${PORT1}${server1.subscriptionsPath}`);

  const app2 = express();
  const httpLink = new HttpLink({
    uri: `http://localhost:${PORT1}${server1.graphqlPath}`,
    fetch,
  });
  const wsLink = new ApolloLink((operation) => {
    return new WebSocketLink({
      uri: `ws://localhost:${PORT1}${server1.subscriptionsPath}`,
      webSocketImpl: ws,
    }).request(operation);
  });
  const link = from([
    split(
      (operation) => {
        const definition = getMainDefinition(operation.query);
        return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
      },
      wsLink,
      httpLink
    ),
  ]);
  introspectSchema(link)
    .then((schema) =>
      makeRemoteExecutableSchema({
        schema,
        link,
      })
    )
    .then((executableSchema) => {
      const server2 = new ApolloServer({
        schema: executableSchema,
      });
      server2.applyMiddleware({ app: app2 });
      const httpServer2 = http.createServer(app2);
      server2.installSubscriptionHandlers(httpServer2);
      const PORT2 = 4001;
      httpServer2.listen(PORT2, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT2}${server2.graphqlPath}`);
        console.log(`🚀 Subscriptions ready at ws://localhost:${PORT2}${server2.subscriptionsPath}`);
      });
    });
});
