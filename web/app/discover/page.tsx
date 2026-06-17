import DiscoverFeed from '@/features/discover/DiscoverFeed'
import BottomNav from '@/components/BottomNav'

export const metadata = { title: 'Discover — From' }

export default function DiscoverPage() {
  return (
    <>
      <DiscoverFeed />
      <BottomNav active="discover" />
    </>
  )
}
