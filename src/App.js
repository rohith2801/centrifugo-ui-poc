import React, { useEffect, useRef, useState } from 'react';
import { Centrifuge, UnauthorizedError } from 'centrifuge';
import axios from 'axios';

async function getToken() {
  const res = await fetch('http://localhost:8000/centrifuge/connection_token');
  if (!res.ok) {
    if (res.status === 403) {
      // Return special error to not proceed with token refreshes, client will be disconnected.
      throw new UnauthorizedError();
    }
    // Any other error thrown will result into token refresh re-attempts.
    throw new Error(`Unexpected status code ${res.status}`);
  }
  const text = await res.text();
  console.warn("text", text);
  const data = await res.json();
  console.warn("token", data.token);
  return data.token;
}

const centrifuge = new Centrifuge('ws://localhost:8000/connection/websocket', { debug: true });

const App = ({ eventId }) => {
  const [reactions, setReactions] = useState([]);
  const subRef = useRef(null);

  useEffect(() => {
    console.warn("Centrifuge state before connect:", centrifuge.state);
    // centrifuge.connect();

    centrifuge.on('connected', (ctx) => {
      console.warn("connected", ctx);

      if (subRef.current == null) {
        console.warn("new subscription");
        subRef.current = centrifuge.newSubscription(`event-channel-${eventId}`);

        subRef.current.on('subscribe', (ctx) => {
          console.warn("subscribed", ctx);
        });

        subRef.current.on('publication', (ctx) => {
          console.warn("publication", ctx, ctx.data);
          setReactions((prevReactions) => [...prevReactions, ctx.data]);
        });

        subRef.current.on('unsubscribe', (ctx) => {
          console.warn("unsubscribed", ctx);
        });

        subRef.current.subscribe();
      }
    });

    centrifuge.on('disconnected', (ctx) => {
      console.warn("disconnected", ctx);
    });

    centrifuge.on('error', (ctx) => {
      console.error("connection error", ctx);
    });

    centrifuge.connect();

    return () => {
      subRef.current?.unsubscribe();
      centrifuge.disconnect();
    };
  }, [eventId]);

  const sendReaction = (emoji) => {
    const reaction = { eventId, emoji, userId: 'user123' };
    // axios.post('http://localhost:8080/centrifuge-poc/api/reactions', reaction);
    if (subRef.current && subRef.current.state === 'subscribed') {
      console.warn("i am already subscribed.. Hence publishing the reaction");
      subRef.current.publish(reaction);
    } else {
      console.error("Subscription is not active..");
      // subRef.current.subscribe();
      // subRef.current.on('subscribe', () => {
      //   subRef.current.publish(reaction);
      // });
    }
  };

  return (
    <div>
      <h1>Event Page</h1>
      <div>
        {reactions.map((reaction, index) => (
          <span key={index}>{reaction?.emoji} </span>
        ))}
      </div>
      <button onClick={() => sendReaction('😊')}>😊</button>&nbsp;
      <button onClick={() => sendReaction('👍')}>👍</button>
    </div>
  );
};

export default App;
