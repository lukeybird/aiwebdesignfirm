import type { Metadata } from 'next';
import UConnectStyled from './UConnectStyled';

export const metadata: Metadata = {
  title: 'UConnect — Log in',
  description: 'Find everyday groups with your close friends. Log into UConnect.',
};

export default function MyStyleBoiPage() {
  return <UConnectStyled />;
}
