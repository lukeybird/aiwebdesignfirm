import type { Metadata } from 'next';
import BabyMonitorClient from './BabyMonitorClient';
import './baby.css';

export const metadata: Metadata = {
  title: 'Private Baby Monitor',
  description: 'A private baby camera you can securely view from anywhere.',
};

export default function BabyMonitorPage() {
  return <BabyMonitorClient />;
}
