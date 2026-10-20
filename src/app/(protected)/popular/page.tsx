import { redirect } from 'next/navigation';

// Popular is a catalog sort now.
export default function PopularPage() {
  redirect('/trending?sort=POPULARITY_DESC');
}
