'use client'

import { useEffect, useState } from 'react'
import { formatMoney } from '@/lib/currency'
import { ExchangeRates } from '@/lib/exchangeRates'
import type { Product } from './ProductCard'

interface Props {
  product: Product
  rates: ExchangeRates
  onClose: () => void
  ctaLabel?: string
}

export default function ProductDrawer({
  product,
  rates,
  onClose,
  ctaLabel = 'Buy Now'
}: Props) {
  const [isMounted, setIsMounted] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'details' | 'sizeChart' | 'shipping'>('details')

  // Get all images
  const images = product.media && product.media.length > 0 
    ? product.media.map(m => m.url) 
    : (product.image_url ? [product.image_url] : []);

  useEffect(() => {
    setIsMounted(true)
    document.body.style.overflow = 'hidden'
    
    // Auto-select first value for options if present
    if (product.options && product.options.length > 0) {
      const initial: Record<string, string> = {}
      product.options.forEach(opt => {
        if (opt.values && opt.values.length > 0) {
          initial[opt.name] = opt.values[0]
        }
      })
      setSelectedOptions(initial)
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [product])

  // Locate the variant matching the selected options
  const matchedVariant = product.variants?.find(v => {
    return v.options.every(opt => {
      const selectedValue = selectedOptions[opt.name];
      return selectedValue === opt.label || selectedValue === (opt as any).value || selectedValue === (opt as any).name;
    });
  }) || product.variants?.[0]; // Fallback to first variant

  // Determine checkout URL
  let checkoutUrl = product.store_url;
  const isFullySelected = product.options 
    ? product.options.every(opt => selectedOptions[opt.name] !== undefined)
    : true;

  if (isFullySelected && matchedVariant) {
    try {
      const urlObj = new URL(product.store_url);
      const shopDomain = urlObj.hostname;
      // Extract numeric ID from variant GID (e.g. gid://shopify/ProductVariant/123456789 -> 123456789)
      const numericId = matchedVariant.id.split('/').pop();
      checkoutUrl = `https://${shopDomain}/cart/${numericId}:1`;
    } catch (e) {
      console.warn("Failed to parse store url for checkout link generation:", e);
    }
  }

  // Parse materials from tags or description
  const extractMaterials = () => {
    const materialTags = product.tags.filter(t => t.includes('material') || t.includes('fabric'));
    if (materialTags.length > 0) {
      return materialTags.map(t => t.split('=>').pop()?.trim()).join(', ');
    }
    const matches = product.description?.match(/(cotton|linen|wool|silk|hemp|polyester|leather|canvas|cashmere)/i);
    return matches ? matches[0] : 'Premium organic blend';
  };

  const material = extractMaterials();

  // Return policy check
  const isReturnable = product.tags.some(t => t.toLowerCase().includes('returnable => true') || t.toLowerCase().includes('return'));

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(23, 28, 23, 0.45)',
        backdropFilter: 'blur(8px)',
        opacity: isMounted ? 1 : 0,
        transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          width: '100%',
          maxWidth: '880px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.12)',
          transform: isMounted ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          border: '1px solid var(--m-border)',
          borderBottom: 'none',
        }}
      >
        {/* Handle Bar for sliding visual */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px 0', cursor: 'pointer' }} onClick={onClose}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--m-border)' }} />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 16,
            background: 'var(--bg)',
            border: '1px solid var(--m-border)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink)',
            zIndex: 10,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--m-green-light)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg)'}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>

        {/* Inner Scrollable Wrapper */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-0 h-full">
            
            {/* Left Column: Visual Media (Columns: 5) */}
            <div className="md:col-span-6 flex flex-col p-6 gap-4 border-r border-[var(--m-border)]">
              
              {/* Image display in 4:5 aspect ratio */}
              <div 
                style={{ 
                  width: '100%', 
                  aspectRatio: '4/5', 
                  borderRadius: 16, 
                  overflow: 'hidden',
                  background: '#F9F9FB',
                  border: '1px solid var(--m-border)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {images.length > 0 ? (
                  <img 
                    src={images[activeImageIndex]} 
                    alt={product.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 28 28" fill="none" stroke="var(--m-green)" strokeWidth="1" opacity="0.3">
                    <path d="M4 7l5-3h10l5 3-4 4v12H8V11L4 7z" />
                  </svg>
                )}
              </div>

              {/* Thumbnails Row */}
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      style={{
                        flex: '0 0 64px',
                        height: '80px',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: idx === activeImageIndex ? '2px solid var(--m-green)' : '1px solid var(--m-border)',
                        cursor: 'pointer',
                        padding: 0,
                        background: 'transparent',
                        transition: 'border 0.2s',
                      }}
                    >
                      <img src={img} alt={`Thumbnail ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Detailed Product Info (Columns: 7) */}
            <div className="md:col-span-6 flex flex-col p-6 overflow-y-auto">
              <div>
                <span 
                  style={{ 
                    fontSize: 10, 
                    fontWeight: 700, 
                    letterSpacing: '0.12em', 
                    textTransform: 'uppercase', 
                    color: 'var(--ink3)' 
                  }}
                >
                  {product.vendor}
                </span>
                
                <h2 
                  style={{ 
                    fontSize: 22, 
                    fontWeight: 600, 
                    color: 'var(--ink)', 
                    lineHeight: 1.25, 
                    marginTop: 4, 
                    marginBottom: 6,
                    paddingRight: 24 
                  }}
                >
                  {product.title}
                </h2>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>
                    {formatMoney(
                      Number(matchedVariant?.price ?? product.price), 
                      product.currency, 
                      product.base_currency, 
                      rates
                    )}
                  </span>
                  
                  {matchedVariant && !matchedVariant.availability && (
                    <span style={{ fontSize: 12, color: '#d9534f', fontWeight: 600 }}>
                      Out of stock
                    </span>
                  )}
                </div>
              </div>

              {/* Dynamic Interactive Selectors */}
              {product.options && product.options.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                  {product.options.map((opt, idx) => (
                    <div key={idx}>
                      <div 
                        style={{ 
                          fontSize: 11, 
                          fontWeight: 700, 
                          color: 'var(--ink2)', 
                          marginBottom: 8, 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em' 
                        }}
                      >
                        Select {opt.name}
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {opt.values.map((val, vIdx) => {
                          const isSelected = selectedOptions[opt.name] === val;
                          return (
                            <button
                              key={vIdx}
                              onClick={() => setSelectedOptions(prev => ({ ...prev, [opt.name]: val }))}
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                background: isSelected ? 'var(--m-green-light)' : 'var(--bg)',
                                border: `1px solid ${isSelected ? 'var(--m-green)' : 'var(--m-border)'}`,
                                color: isSelected ? 'var(--m-green)' : 'var(--ink)',
                                padding: '8px 16px',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Accordion tabs */}
              <div style={{ borderTop: '1px solid var(--m-border)', marginTop: 12, paddingTop: 16 }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--m-border)', marginBottom: 12, gap: 16 }}>
                  {[
                    { id: 'details', label: 'Details' },
                    { id: 'sizeChart', label: 'Size Chart' },
                    { id: 'shipping', label: 'Delivery' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      style={{
                        paddingBottom: 8,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === tab.id ? '2px solid var(--m-green)' : '2px solid transparent',
                        color: activeTab === tab.id ? 'var(--m-green)' : 'var(--ink3)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Contents */}
                <div style={{ minHeight: '150px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink2)' }}>
                  {activeTab === 'details' && (
                    <div>
                      <p style={{ marginBottom: 12 }}>{product.description || "No description provided by merchant."}</p>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--m-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink3)' }}>Material</span>
                          <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{material}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink3)' }}>Returns</span>
                          <span style={{ fontWeight: 500, color: 'var(--ink)' }}>
                            {isReturnable ? "30 days (via Loop)" : "Standard 30 days"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'sizeChart' && (
                    <div>
                      <p style={{ marginBottom: 10, fontSize: 12, color: 'var(--ink3)' }}>
                        Refer to our standard sizing guide below to find your perfect fit:
                      </p>
                      
                      {/* Sizing Chart Table */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--m-border)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink3)' }}>
                            <th style={{ padding: '6px 0' }}>Size</th>
                            <th>Chest (in)</th>
                            <th>Waist (in)</th>
                            <th>Sleeve (in)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { sz: 'S', ch: '35 - 37', wa: '29 - 31', sl: '32.5' },
                            { sz: 'M', ch: '38 - 40', wa: '32 - 34', sl: '33.5' },
                            { sz: 'L', ch: '41 - 43', wa: '35 - 37', sl: '34.5' },
                            { sz: 'XL', ch: '44 - 46', wa: '38 - 40', sl: '35.5' },
                            { sz: 'XXL', ch: '47 - 49', wa: '41 - 43', sl: '36.5' }
                          ].map((row, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                              <td style={{ padding: '6px 0', fontWeight: 600, color: 'var(--ink)' }}>{row.sz}</td>
                              <td>{row.ch}</td>
                              <td>{row.wa}</td>
                              <td>{row.sl}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'shipping' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <h4 style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>⚡ Fast Shipping</h4>
                        <p>Orders are dispatched within 24-48 hours. Delivery takes 3-5 business days.</p>
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>📦 Returns Policy</h4>
                        <p>Easy 30-day return policy. Unworn items in original packaging are fully refundable.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Checkout CTA block */}
              <div style={{ marginTop: 'auto', paddingTop: 24 }}>
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '14px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    background: 'var(--m-green)',
                    color: 'var(--bg-white)',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(90, 154, 90, 0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#4e8d4e'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(90, 154, 90, 0.45)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--m-green)'
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(90, 154, 90, 0.3)'
                  }}
                >
                  {matchedVariant ? `${ctaLabel} (${matchedVariant.title})` : ctaLabel}
                </a>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
