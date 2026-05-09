import AuthProvider from '@/components/AuthProvider'

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
