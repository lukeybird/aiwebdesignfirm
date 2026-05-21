import type { Metadata } from 'next';
import PapersGenerator from './PapersGenerator';

export const metadata: Metadata = {
  title: 'Papers PDF Generator',
  description: 'Create immigration filing letters and certificates of service from reusable fields.',
};

export default function PapersPage() {
  return <PapersGenerator />;
}
