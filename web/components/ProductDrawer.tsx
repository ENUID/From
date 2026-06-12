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
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({})
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'details' | 'sizeChart' | 'shipping'>('details')
  const [isMobile, setIsMobile] = useState(false)
  const [sizeUnit, setSizeUnit] = useState<'in' | 'cm'>('in')

  // Get all unique images across root image, root media, and variant media
  const getUniqueImages = () => {
    const list: string[] = [];
    if (product.image_url && product.image_url.trim().length > 0) {
      list.push(product.image_url);
    }
    if (product.media && product.media.length > 0) {
      product.media.forEach(m => {
        if (m.url && !list.includes(m.url)) {
          list.push(m.url);
        }
      });
    }
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(v => {
        if (v.media && v.media.length > 0) {
          v.media.forEach(m => {
            if (m.url && !list.includes(m.url)) {
              list.push(m.url);
            }
          });
        }
      });
    }
    return list;
  };

  const images = getUniqueImages();

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

    const handleResize = () => setIsMobile(window.innerWidth < 768)
    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('resize', handleResize)
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

  // Strips HTML and extracts clean text with linebreaks
  const getProductDescriptionText = () => {
    if (!product.description) return '';
    if (typeof product.description === 'string') {
      return product.description;
    }
    const descObj = product.description as any;
    if (descObj.html) {
      let html = descObj.html;
      html = html.replace(/<br\s*\/?>/gi, '\n');
      html = html.replace(/<\/p>/gi, '\n');
      html = html.replace(/<\/div>/gi, '\n');
      html = html.replace(/<\/li>/gi, '\n');
      html = html.replace(/<[^>]*>/g, '');
      return html.trim();
    }
    return '';
  };

  const rawDescriptionText = getProductDescriptionText();

  // Parse materials from tags or description
  const extractMaterials = () => {
    if (product.tags) {
      const materialTags = product.tags.filter(t => t && (t.toLowerCase().includes('material') || t.toLowerCase().includes('fabric')));
      if (materialTags.length > 0) {
        return materialTags.map(t => t.split('=>').pop()?.trim()).join(', ');
      }
    }
    const matches = rawDescriptionText.match(/(cotton|linen|wool|silk|hemp|polyester|leather|canvas|cashmere|denim|viscose|nylon|spandex)/i);
    return matches ? matches[0] : '';
  };

  const material = extractMaterials();

  // Return policy check
  const isReturnable = product.tags ? product.tags.some(t => t && (t.toLowerCase().includes('returnable => true') || t.toLowerCase().includes('return'))) : false;

  // Extract sizing details from the store description or tags.
  const extractSizingInfo = () => {
    if (product.tags) {
      const chartTag = product.tags.find(t => t && (t.toLowerCase().includes('size-chart') || t.toLowerCase().includes('size chart') || t.toLowerCase().includes('sizing')));
      if (chartTag) {
        return chartTag.split('=>').pop()?.trim() || '';
      }
    }

    if (!rawDescriptionText) return '';
    const lines = rawDescriptionText.split('\n');
    const sizingLines = lines.filter((line: string) => {
      const lower = line.toLowerCase();
      // Search for specific size chart indicators, or key metrics paired with values
      return /\b(size\s+chart|size\s+guide|sizing\s+chart|sizing\s+guide|fit\s+guide|measurements)\b/.test(lower) ||
             /\b(chest|waist|inseam|hip|hips|shoulder|sleeve|bust)\b\s*:\s*\d+/.test(lower);
    });

    if (sizingLines.length > 0) {
      return sizingLines.map((l: string) => l.trim()).join('\n');
    }
    return '';
  };

  const sizingContent = extractSizingInfo();

  // Extract shipping and delivery details from the store description or tags.
  const extractShippingInfo = () => {
    let tagInfo = '';
    if (product.tags) {
      const shipTag = product.tags.find(t => t && (t.toLowerCase().includes('shipping') || t.toLowerCase().includes('delivery')));
      const returnTag = product.tags.find(t => t && (t.toLowerCase().includes('return') || t.toLowerCase().includes('refund')));
      if (shipTag) tagInfo += `Shipping: ${shipTag.split('=>').pop()?.trim()}\n`;
      if (returnTag) tagInfo += `Returns: ${returnTag.split('=>').pop()?.trim()}\n`;
    }

    if (!rawDescriptionText) return tagInfo.trim();
    const lines = rawDescriptionText.split('\n');
    const shippingLines = lines.filter((line: string) => {
      const lower = line.toLowerCase();
      // Look for explicit shipping phrases, or shipping terms excluding normal verbs like "delivers comfort"
      return /\b(shipping\s+policy|return\s+policy|free\s+shipping|standard\s+shipping|express\s+shipping|shipping\s+carrier|delivery\s+time|delivery\s+carrier|dispatch\s+time)\b/.test(lower) ||
             (/\b(shipping|delivery|dispatch|returns|refunds|postage|transit|fulfillment|courier)\b/.test(lower) && 
              !/\b(delivers\b|returns\s+to\b|returns\s+the\b)/.test(lower));
    });

    if (shippingLines.length > 0 || tagInfo) {
      return (tagInfo + '\n' + shippingLines.map((l: string) => l.trim()).join('\n')).trim();
    }
    return '';
  };

  const shippingContent = extractShippingInfo();

  const category = (() => {
    const title = product.title.toLowerCase();
    const type = (product.product_type || '').toLowerCase();
    const tags = (product.tags || []).map(t => (t || '').toLowerCase());

    const isFootwear = 
      type.includes('shoe') || type.includes('footwear') || type.includes('sneaker') || type.includes('boot') || type.includes('sandal') || type.includes('slip-on') || type.includes('heel') || type.includes('runner') || type.includes('clog') || type.includes('slide') ||
      tags.some(t => t.includes('shoe') || t.includes('footwear') || t.includes('sneaker') || t.includes('boot') || t.includes('sandal')) ||
      /\b(shoes|shoe|sneakers|sneaker|boots|boot|sandals|sandal|slippers|slipper|heels|heel|runners|runner|allbirds|footwear)\b/.test(title);

    if (isFootwear) return 'footwear';

    const isClothing =
      type.includes('shirt') || type.includes('apparel') || type.includes('clothing') || type.includes('pant') || type.includes('tee') || type.includes('hoodie') || type.includes('jacket') || type.includes('coat') || type.includes('shorts') || type.includes('jean') || type.includes('dress') || type.includes('skirt') || type.includes('sweater') || type.includes('cardigan') ||
      tags.some(t => t.includes('clothing') || t.includes('apparel') || t.includes('shirt') || t.includes('pant')) ||
      /\b(shirt|shirts|t-shirt|tshirts|t-shirts|tshirt|tee|tees|pants|pant|trousers|trouser|jeans|jean|hoodie|hoodies|jacket|jackets|coat|coats|sweater|sweaters|cardigan|cardigans|shorts|short|dress|dresses|skirt|skirts|clothing|apparel|linen|top|tops|blouse|blouses)\b/.test(title);

    if (isClothing) return 'apparel';

    return 'other';
  })();

  const isBottoms = (() => {
    const title = product.title.toLowerCase();
    const type = (product.product_type || '').toLowerCase();
    return type.includes('pant') || type.includes('short') || type.includes('jean') || type.includes('trouser') ||
      /\b(pants|pant|trousers|trouser|jeans|jean|shorts|short|leggings|legging|chinos|chino|sweatpants|joggers|jogger)\b/.test(title);
  })();

  const getCareInstructions = (mat: string) => {
    const lower = mat.toLowerCase();
    if (lower.includes('wool') || lower.includes('silk') || lower.includes('cashmere')) {
      return 'Dry clean recommended. Gentle hand wash in cold water with mild detergent. Lay flat to dry.';
    }
    if (lower.includes('leather')) {
      return 'Professional leather clean only. Wipe with damp cloth to clean dust. Avoid direct sunlight.';
    }
    if (lower.includes('linen') || lower.includes('cotton')) {
      return 'Machine wash cold with like colors. Tumble dry low. Warm iron if needed. Do not bleach.';
    }
    return 'Machine wash cold. Gentle cycle. Hang dry or tumble dry on low heat settings.';
  };

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
        opacity: isMounted ? 1 : 0,
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isMobile ? 'auto' : 'hidden' }}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-0 h-full" style={{ minHeight: 0 }}>
            
            {/* Left Column: Visual Media (Columns: 6) */}
            <div 
              className="md:col-span-6 flex flex-col p-6 gap-4 border-r border-[var(--m-border)]"
              style={isMobile ? {} : { height: '100%', minHeight: 0, overflowY: 'auto' }}
            >
              
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
                {images.length > 0 && !failedImages[activeImageIndex] ? (
                  <img 
                    src={images[activeImageIndex]} 
                    alt={product.title} 
                    onError={() => setFailedImages(prev => ({ ...prev, [activeImageIndex]: true }))}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg)',
                    color: 'var(--ink3)'
                  }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
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
                      {!failedImages[idx] ? (
                        <img 
                          src={img} 
                          alt={`Thumbnail ${idx}`} 
                          onError={() => setFailedImages(prev => ({ ...prev, [idx]: true }))}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--bg)',
                          color: 'var(--ink3)'
                        }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Detailed Product Info (Columns: 6) */}
            <div 
              className="md:col-span-6 flex flex-col p-6"
              style={isMobile ? {} : { height: '100%', minHeight: 0 }}
            >
              {/* 1. Header (Static) */}
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
                  <span style={{ 
                    fontSize: 24, 
                    fontWeight: 700, 
                    color: 'var(--ink)',
                    fontFamily: '"Inter", var(--sans)'
                  }}>
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

              {/* 2. Middle Content (Scrollable) */}
              <div style={isMobile ? { marginTop: 12 } : { flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '16px', marginTop: 12 }}>
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
                      { id: 'details', label: 'Details', show: true },
                      { id: 'sizeChart', label: 'Size Guide', show: !!sizingContent },
                      { id: 'shipping', label: 'Delivery & Returns', show: !!shippingContent }
                    ].filter(t => t.show).map(tab => (
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
                        <p style={{ marginBottom: 16, fontSize: 13.5, color: 'var(--ink)' }}>{rawDescriptionText || "No description provided by the seller."}</p>
                        
                        {(material || isReturnable) && (
                          <div style={{ 
                            background: 'var(--bg)', 
                            borderRadius: 12, 
                            padding: '16px', 
                            border: '1px solid var(--m-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12
                          }}>
                            {material && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isReturnable ? '1px solid rgba(0,0,0,0.03)' : 'none', paddingBottom: isReturnable ? 8 : 0 }}>
                                <span style={{ fontWeight: 600, color: 'var(--ink3)' }}>Material</span>
                                <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{material}</span>
                              </div>
                            )}
                            
                            {material && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderBottom: isReturnable ? '1px solid rgba(0,0,0,0.03)' : 'none', paddingBottom: isReturnable ? 8 : 0 }}>
                                <span style={{ fontWeight: 600, color: 'var(--ink3)' }}>Fabric Care</span>
                                <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{getCareInstructions(material)}</span>
                              </div>
                            )}

                            {isReturnable && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, color: 'var(--ink3)' }}>Returns</span>
                                <span style={{ fontWeight: 500, color: 'var(--ink)' }}>
                                  Easy 30-Day Returns
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'sizeChart' && sizingContent && (
                      <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px', border: '1px solid var(--m-border)', whiteSpace: 'pre-line', fontSize: 13, color: 'var(--ink2)' }}>
                        <h4 style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8, fontSize: 13.5 }}>
                          📏 Size Guide & Fit
                        </h4>
                        {sizingContent}
                      </div>
                    )}

                    {activeTab === 'shipping' && shippingContent && (
                      <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px', border: '1px solid var(--m-border)', whiteSpace: 'pre-line', fontSize: 13, color: 'var(--ink2)' }}>
                        <h4 style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8, fontSize: 13.5 }}>
                          🚚 Delivery & Returns Info
                        </h4>
                        {shippingContent}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Checkout CTA block (Static at bottom) */}
              <div style={{ paddingTop: 16 }}>
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
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
