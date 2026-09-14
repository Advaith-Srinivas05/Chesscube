import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../Avatar.jsx';
import Button from '../ui/Button.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Tabs, { TabPanel } from '../ui/Tabs.jsx';
import { shortDate } from './FriendList.jsx';
import styles from './Social.module.css';

function RequestRow({ request, children }) {
  const { username, avatar } = request.user;
  return (
    <li className={styles.row}>
      <Avatar id={avatar} size={40} />
      <div className={styles.who}>
        <Link to={`/u/${username}`} className={styles.name}>
          {username}
        </Link>
        <span className={styles.meta}>{shortDate(request.createdAt)}</span>
      </div>
      <div className={styles.actions}>{children}</div>
    </li>
  );
}

export default function FriendRequests({ incoming, outgoing, onAccept, onDecline, onCancel, isBusy }) {
  const [tab, setTab] = useState('incoming');

  const items = [
    {
      value: 'incoming',
      label: (
        <>
          Incoming
          {incoming.length > 0 && <span className={styles.tabCount}>{incoming.length}</span>}
        </>
      ),
    },
    { value: 'outgoing', label: 'Sent' },
  ];

  return (
    <section className={styles.panel} aria-labelledby="requests-title">
      <h2 id="requests-title" className={styles.heading}>
        Requests
      </h2>
      <Tabs id="friend-requests" label="Friend requests" items={items} value={tab} onChange={setTab} className={styles.tabs} />
      <TabPanel tabsId="friend-requests" value={tab}>
        {tab === 'incoming' ? (
          incoming.length === 0 ? (
            <EmptyState className={styles.empty} title="No incoming requests" text="Requests other players send you show up here." />
          ) : (
            <ul className={styles.list}>
              {incoming.map((request) => {
                const busy = isBusy(request.user.username);
                return (
                  <RequestRow key={request.user.username} request={request}>
                    <Button size="sm" onClick={() => onAccept(request)} disabled={busy}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDecline(request)} disabled={busy}>
                      Decline
                    </Button>
                  </RequestRow>
                );
              })}
            </ul>
          )
        ) : outgoing.length === 0 ? (
          <EmptyState className={styles.empty} title="No sent requests" text="Requests you send wait here until they're answered." />
        ) : (
          <ul className={styles.list}>
            {outgoing.map((request) => (
              <RequestRow key={request.user.username} request={request}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onCancel(request)}
                  disabled={!request.id || isBusy(request.user.username)}
                >
                  Cancel
                </Button>
              </RequestRow>
            ))}
          </ul>
        )}
      </TabPanel>
    </section>
  );
}
