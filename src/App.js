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
  const [emojiCounts, setEmojiCounts] = useState(new Map());

  const eventChannelSubRef = useRef(null);
  const eventHostAnalyticsSubRef = useRef(null);

  const queryParams = new URLSearchParams(window.location.search);
  const userType = queryParams.get('userType') || "user";

  useEffect(() => {
    console.warn("Centrifuge state before connect:", centrifuge.state);
    // centrifuge.connect();

    centrifuge.on('connected', (ctx) => {
      console.warn("connected", ctx);

      if (eventChannelSubRef.current == null) {
        console.warn("new subscription");
        eventChannelSubRef.current = centrifuge.newSubscription(`event-channel-${eventId}`);

        eventChannelSubRef.current.on('subscribe', (ctx) => {
          console.warn("subscribed", ctx);
        });

        eventChannelSubRef.current.on('publication', (ctx) => {
          console.warn("publication", ctx, ctx.data);
          setReactions((prevReactions) => [...prevReactions, ctx.data]);
        });

        eventChannelSubRef.current.on('unsubscribe', (ctx) => {
          console.warn("unsubscribed", ctx);
        });

        eventChannelSubRef.current.subscribe();
      }

      if (userType === "eventHost" && eventHostAnalyticsSubRef.current == null) {
        console.warn("new host analytics subscription");
        eventHostAnalyticsSubRef.current = centrifuge.newSubscription(`event-channel-${eventId}-host-analytics`);

        eventHostAnalyticsSubRef.current.on('subscribe', (ctx) => {
          console.warn("host analytics subscribed", ctx);
        });

        eventHostAnalyticsSubRef.current.on('publication', (ctx) => {
          console.warn("host analytics publication", ctx, ctx.data);
          const counts = new Map();
          ctx.data.forEach((reaction) => {
            const emoji = reaction.emoji;
            if (counts.has(emoji)) {
              counts.set(emoji, counts.get(emoji) + 1);
            } else {
              counts.set(emoji, 1);
            }
          });
          setEmojiCounts(counts);
        });

        eventHostAnalyticsSubRef.current.on('unsubscribe', (ctx) => {
          console.warn("host analytics unsubscribed", ctx);
        });

        eventHostAnalyticsSubRef.current.subscribe();
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
      eventChannelSubRef.current?.unsubscribe();
      eventHostAnalyticsSubRef.current?.unsubscribe();
      centrifuge.disconnect();
    };
  }, [eventId, userType]);

  const sendReaction = (emoji) => {
    const reaction = { eventId, emoji, userId: 'user123' };
    // axios.post('http://localhost:8080/centrifuge-poc/api/reactions', reaction);
    if (eventChannelSubRef.current && eventChannelSubRef.current.state === 'subscribed') {
      console.warn("i am already subscribed.. Hence publishing the reaction");
      eventChannelSubRef.current.publish(reaction);
    } else {
      console.error("Subscription is not active..");
      // eventChannelSubRef.current.subscribe();
      // eventChannelSubRef.current.on('subscribe', () => {
      //   eventChannelSubRef.current.publish(reaction);
      // });
    }
  };

  return (
    <div>
      <h1>Event Page</h1>
      <hr />
      <span>
        {reactions && reactions.length > 0 && <h3 style={{ fontWeight: 'bold' }}>Reactions:</h3>}
        <span style={{ display: 'flex', flexWrap: 'wrap' }}>
          {reactions.map((reaction, index) => (
            <span key={index} style={{ marginRight: '5px' }}>{reaction?.emoji}</span>
          ))}
        </span>
      </span>
      <hr />
      <div>
        <button onClick={() => sendReaction('😊')}>😊</button>&nbsp;
        <button onClick={() => sendReaction('👍')}>👍</button>
      </div>
      <hr />
      {userType === "eventHost" && (
        <div>
          <h3>Host Analytics</h3>
          <table style={{ marginLeft: '40px', border: '1px solid black', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid black', padding: '5px' }}>Emoji</th>
                <th style={{ border: '1px solid black', padding: '5px' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {emojiCounts.size > 0 && Array.from(emojiCounts).map(([emoji, count]) => (
                <tr key={emoji}>
                  <td style={{ border: '1px solid black', padding: '5px' }}>{emoji}</td>
                  <td style={{ border: '1px solid black', padding: '5px' }}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default App;
