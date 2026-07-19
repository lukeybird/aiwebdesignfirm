import type { Metadata } from 'next';
import BabyMonitorClient from './BabyMonitorClient';
import './baby.css';

export const metadata: Metadata = {
  title: 'Private Baby Monitor',
  description: 'A private, same-Wi-Fi baby camera and viewer.',
};

export default function BabyMonitorPage() {
  return <BabyMonitorClient />;
}
