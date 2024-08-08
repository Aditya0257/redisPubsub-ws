import { RedisClientType, createClient } from "redis";

export class RedisClient {
  private static instance: RedisClient;
  public subscriber: RedisClientType;
  public publisher: RedisClientType;
  public subscriptions: Map<string, string[]>;
  public reverseSubscriptions: Map<
    string,
    { [userId: string]: { userId: string; ws: WebSocket } }
  >;

  // subscriptions => {user1: [room1, room2], user2: [room3, room1], ...}
  // reverseSubscriptions => {
  //    room1: {
  //      user1: {user1, ws1},
  //      user2: {user2, ws2},
  //      user3: {user3, ws3},
  //      ...
  //    },
  //    room2: {
  //      user6: {user6, ws6},
  //      user2: {user2, ws2},
  //    }
  //    ...
  // }

  private constructor() {
    this.subscriber = createClient();
    this.publisher = createClient();
    this.subscriber.connect();
    this.publisher.connect();
    this.subscriptions = new Map<string, string[]>();
    this.reverseSubscriptions = new Map<
      string,
      { [userId: string]: { userId: string; ws: WebSocket } }
    >();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new RedisClient();
    }
    return this.instance;
  }

  subscribe(userId: string, room: string, ws: any) {
    // Add the room to the list of rooms this user is subscribed to
    this.subscriptions.set(userId, [
      ...(this.subscriptions.get(userId) || []),
      room,
    ]);

    // Add the user's WebSocket to the list of connections in this room
    this.reverseSubscriptions.set(room, {
      ...(this.reverseSubscriptions.get(room) || {}),
      [userId]: { userId: userId, ws: ws },
    });

    // If this is the first user in the room, subscribe to the Redis channel for this room
    if (Object.keys(this.reverseSubscriptions.get(room) || {}).length === 1) {
      console.log(`First User came, Now subscribing to the room - ${room}`);
      this.subscriber.subscribe(room, (payload) => {
        try {
          // Send the incoming Redis message to all WebSocket clients in the room
          Object.values(this.reverseSubscriptions.get(room) || {}).forEach(
            function (item) {
              item.ws.send(payload);
            },
          );
        } catch (e) {
          console.log("error in the payload");
        }
      });
    }
  }

  unsubscribe(userId: string, roomToUnsubscribe: string) {
    // Remove the room from the user's subscription list
    this.subscriptions.set(
      userId,
      this.subscriptions.get(userId)?.filter(function (r) {
        if (r !== roomToUnsubscribe) return true;
        else return false;
      }) || [],
    );

    // If the user is no longer subscribed to any rooms, remove the user from subscriptions
    if ((this.subscriptions.get(userId) || []).length === 0) {
      this.subscriptions.delete(userId);
    }

    // Remove the user from the reverseSubscriptions for the specified room
    delete this.reverseSubscriptions.get(roomToUnsubscribe)?.[userId];

    // If the room has no more subscribers, unsubscribe from the Redis channel and clean up
    if (
      Object.keys(this.reverseSubscriptions.get(roomToUnsubscribe) || {})
        .length === 0
    ) {
      console.log(
        `Deleting this room - ${roomToUnsubscribe} as there are no users left inside it`,
      );
      this.subscriber.unsubscribe(roomToUnsubscribe);
      this.reverseSubscriptions.delete(roomToUnsubscribe);
    }
  }

  publish(room: string, message: any) {
    // Publish a message to the specified room in the Redis Pub/Sub system
    console.log(`publishing message to ${room}`);
    this.publisher.publish(room, message);
  }
}
