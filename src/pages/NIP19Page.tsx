import { nip19 } from 'nostr-tools';
import { useParams } from 'react-router-dom';

import NotFound from './NotFound';
import { ProfileView } from '@/components/nostr/ProfileView';
import { EventView } from '@/components/nostr/EventView';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  let decoded;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return <NotFound />;
  }

  const { type } = decoded;

  switch (type) {
    case 'npub':
      return (
        <div className="mx-auto w-full max-w-4xl">
          <ProfileView pubkey={decoded.data as string} />
        </div>
      );

    case 'nprofile': {
      const { pubkey } = decoded.data as { pubkey: string };
      return (
        <div className="mx-auto w-full max-w-4xl">
          <ProfileView pubkey={pubkey} />
        </div>
      );
    }

    case 'note':
      return <EventView id={decoded.data as string} />;

    case 'nevent': {
      const { id, author, kind } = decoded.data as {
        id: string;
        author?: string;
        kind?: number;
      };
      return <EventView id={id} author={author} kind={kind} />;
    }

    case 'naddr': {
      const { kind, pubkey, identifier: d } = decoded.data as {
        kind: number;
        pubkey: string;
        identifier: string;
      };
      return <EventView kind={kind} author={pubkey} identifier={d} />;
    }

    default:
      // nsec, nrelay and unknown identifiers are never rendered
      return <NotFound />;
  }
}
