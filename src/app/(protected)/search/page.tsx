import { redirect } from 'next/navigation';

type Props = { searchParams: Promise<{ q?: string }> };

// Full search results live in the catalog (relevance-sorted when q is set).
export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  redirect(q?.trim() ? `/trending?q=${encodeURIComponent(q.trim())}` : '/trending');
}
