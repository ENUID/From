import { useState, useEffect } from 'react'
import { ShopperContext } from "@/lib/shopperContext"
import { SearchHistoryEntry } from '../hooks/useDiscernChat'

export default function DiscoverView({
  shopperContext,
  searchHistory,
  sendMessage,
}: {
  shopperContext: ShopperContext
  searchHistory: SearchHistoryEntry[]
  sendMessage: (text: string) => void
}) {
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)

  const defaultSuggestions = [
    'Eco-friendly denim',
    'Handmade leather wallet',
    'Minimalist ceramics',
    'Linen shirts under $80',
  ]

  useEffect(() => {
    if (searchHistory && searchHistory.length > 0) {
      setLoadingRecs(true)
      fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: searchHistory }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.recommendations && data.recommendations.length > 0) {
            setRecommendations(data.recommendations)
          }
        })
        .catch(console.error)
        .finally(() => setLoadingRecs(false))
    }
  }, [searchHistory])

  const suggestionsToShow = recommendations.length > 0 ? recommendations : defaultSuggestions
  const suggestionLabel = recommendations.length > 0 ? 'Recommended for You' : 'Try searching for'

  return (
    <div className="flex-1 grid content-center gap-6 md:gap-10 max-w-[800px] mx-auto py-5 md:py-10 text-center">
      <div className="fade-in">
        <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--m-green)] font-semibold mb-2.5 md:mb-4">
          Discern
        </div>
        <h1 className="font-serif text-[42px] md:text-[clamp(42px,6vw,76px)] leading-[0.96] font-light text-[var(--ink)] mb-3.5 md:mb-5 tracking-[-0.04em]">
          Search by intent,
          <br />
          not by ads.
        </h1>
        <p className="max-w-[540px] text-[14px] md:text-[15.5px] text-[var(--ink3)] leading-[1.7] font-light mx-auto">
          Discern matches items from verified independent stores. Describe what you need, the context, budget, or style, and discover unique finds.
        </p>
        <p className="mt-3 text-[12.5px] md:text-[13px] text-[var(--m-green)] tracking-[0.04em]">
          Prices shown in {shopperContext.currency} for shoppers in {shopperContext.country}.
        </p>
      </div>

      <div className="fade-in" style={{ animationDelay: '0.1s', minHeight: '80px' }}>
        <div className="text-[10px] tracking-[0.12em] uppercase text-[var(--ink3)] mb-3.5 flex items-center justify-center gap-2">
          {suggestionLabel}
          {loadingRecs && <div className="w-[10px] h-[10px] rounded-full border border-[var(--ink3)] border-t-transparent animate-spin" />}
        </div>
        <div className="flex gap-2.5 flex-wrap justify-center px-2.5 md:px-0">
          {suggestionsToShow.map(text => (
            <button
              key={text}
              type="button"
              onClick={() => sendMessage(text)}
              className="bg-transparent border border-[var(--m-border)] rounded-full px-5 py-2.5 md:px-[18px] md:py-2 text-[14px] md:text-[13px] text-[var(--ink2)] cursor-pointer transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-[var(--m-green-mid)] hover:text-[var(--m-green)] hover:bg-[var(--m-green-light)] hover:-translate-y-[1px]"
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4 mt-4">
        {[
          {
            title: 'Describe the need',
            body: 'Search using plain language instead of exact keywords.',
          },
          {
            title: 'Refine quickly',
            body: 'Keep the conversation going to narrow by budget or use case.',
          },
          {
            title: 'Save products',
            body: 'Keep promising finds in one place during your session.',
          },
        ].map((card, i) => (
          <div
            key={card.title}
            className="fade-in bg-[var(--bg-card)] border border-[var(--m-border)] rounded-[18px] p-[24px_22px_22px] text-left"
            style={{
              animationDelay: `${0.2 + i * 0.1}s`,
            }}
          >
            <div className="text-[13px] font-semibold text-[var(--ink)] mb-2">{card.title}</div>
            <div className="text-[13px] text-[var(--ink3)] leading-[1.7]">{card.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
