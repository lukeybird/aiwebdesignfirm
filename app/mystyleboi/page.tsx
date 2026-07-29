import type { Metadata } from 'next';
import UConnectStyled from './UConnectStyled';

export const metadata: Metadata = {
  title: 'UConnect — Find your vibe.',
  description: 'Small groups. Shared interests. IRL. Connect.',
};

export default function MyStyleBoiPage() {
  return <UConnectStyled />;
}
