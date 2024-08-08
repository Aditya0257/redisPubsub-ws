import { WebSocket } from "ws";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import { RedisClient } from "./subscriber";

const server = http.createServer(function (request: any, response: any) {
  console.log(new Date() + " Received request for " + request.url);
  response.end("hi there");
});

const wss = new WebSocket.Server({ server });

const users: {
  [key: string]: {
    room: string;
    ws: any;
  };
} = {};

wss.on("connection", async function connection(ws) {
  ws.on("error", (error) => {
    console.error(error);
  });

  const id = uuidv4();
  console.log("client connected");

  ws.on("message", function incoming(message) {
    const data = JSON.parse(message.toString());
    if (data.type === "join") {
      // user is joining for the first time, we are currently using in-memory data of node.js process to store users
      users[id] = {
        room: data.payload.roomId,
        ws,
      };
      // In case, this is the first user in this roomId, then wss with which this userId connects, needs to subscribe, we put all if else subscribe logic
      // in redis singleton pattern class
      RedisClient.getInstance().subscribe(id, data.payload.roomId, ws);
    } else if (data.type === "message") {
      // some user is sending message in their respective room, we need to publish this message to redis pubsub, which will then automatically run subscribe
      // callback using redisClient, and the subscribed message will run in that ws server, where all room websocket connections will get this message.
      const roomId = users[id].room;
      const message = data.payload.message;
      RedisClient.getInstance().publish(roomId, message);
    }
  });

  ws.send(`Hello! Message from WS Server!!. id is ${id}`);

  ws.on("close", function () {
    console.log("Client disconnected");
    RedisClient.getInstance().unsubscribe(id, users[id].room);
  });
});

server.listen(8080, () => {
  console.log(new Date() + " Server is listening on port 8080");
});
