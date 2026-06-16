import type { Metadata } from 'next';
import RoutingPlanner from './RoutingPlanner';

export const metadata: Metadata = {
  title: 'Route Planner',
  description: 'Optimize a list of addresses into the most efficient driving route.',
};

export default function RoutingPage() {
  return <RoutingPlanner />;
}
