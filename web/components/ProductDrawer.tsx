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

  // Parse materials from tags or description
  const extractMaterials = () => {
    if (!product.tags) return 'Premium organic blend';
    const materialTags = product.tags.filter(t => t && (t.includes('material') || t.includes('fabric')));
    if (materialTags.length > 0) {
      return materialTags.map(t => t.split('=>').pop()?.trim()).join(', ');
    }
    const matches = product.description?.match(/(cotton|linen|wool|silk|hemp|polyester|leather|canvas|cashmere)/i);
    return matches ? matches[0] : 'Premium organic blend';
  };

  const material = extractMaterials();

  // Return policy check
  const isReturnable = product.tags ? product.tags.some(t => t && (t.toLowerCase().includes('returnable => true') || t.toLowerCase().includes('return'))) : false;

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

  const getDeliveryInfo = () => {
    const currency = product.currency || 'USD';
    const storeUrl = product.store_url || '';
    
    const isIndia = currency === 'INR' || storeUrl.includes('.in');
    const isUK = currency === 'GBP' || storeUrl.includes('.uk') || storeUrl.includes('.co.uk');
    const isEU = currency === 'EUR' || storeUrl.includes('.eu') || storeUrl.includes('.de') || storeUrl.includes('.fr') || storeUrl.includes('.it') || storeUrl.includes('.es');
    const isAustralia = currency === 'AUD' || storeUrl.includes('.au');
    const isCanada = currency === 'CAD' || storeUrl.includes('.ca');

    if (isIndia) {
      return {
        carrier: 'Delhivery, Blue Dart & Xpressbees',
        rates: [
          { method: 'Standard Delivery', time: '3–6 business days', cost: 'Free above ₹999, otherwise ₹99' },
          { method: 'Express Shipping', time: '1–3 business days', cost: 'Flat rate ₹199' }
        ],
        details: 'Orders are processed from local warehouses within 24-48 hours. Metro areas (Mumbai, Delhi, Bengaluru, etc.) typically receive packages in 2-3 business days. A tracking link via SMS & email is sent upon dispatch.',
        returns: 'Easy 7-day returns and exchanges. Reverse pickup is arranged free of charge for manufacturing defects or sizing issues.'
      };
    }

    if (isUK) {
      return {
        carrier: 'Royal Mail & DPD',
        rates: [
          { method: 'Standard Tracked', time: '2–4 business days', cost: 'Free above £50, otherwise £3.95' },
          { method: 'DPD Next Day Delivery', time: 'Next working day', cost: 'Flat rate £6.95' }
        ],
        details: 'Orders placed before 2 PM GMT are dispatched same-day. You will receive a 1-hour delivery window notification from DPD on the day of delivery.',
        returns: 'Hassle-free 30-day returns. Free returns via Royal Mail drop-off points or local Evri locker networks.'
      };
    }

    if (isEU) {
      return {
        carrier: 'DHL Express & DPD Europe',
        rates: [
          { method: 'Standard Courier', time: '3–5 business days', cost: 'Free above €80, otherwise €5.95' },
          { method: 'DHL Express Saver', time: '1–2 business days', cost: 'Flat rate €14.95' }
        ],
        details: 'Shipped from our European fulfillment centers. Fully tracked from dispatch to door. Carbon-neutral delivery options available.',
        returns: '30-day return policy. Return labels can be printed online. Return shipping is free of charge for all EU members.'
      };
    }

    if (isAustralia) {
      return {
        carrier: 'Australia Post & StarTrack',
        rates: [
          { method: 'Parcel Post', time: '3–7 business days', cost: 'Free above A$120, otherwise A$9.95' },
          { method: 'Express Post', time: '1–3 business days', cost: 'Flat rate A$15.00' }
        ],
        details: 'Dispatched from Melbourne. Regional Western Australia and Northern Territory may require an additional 2-3 business days. Tracking details updated via AusPost app.',
        returns: '30-day standard return policy. Print label at home and drop off at any Australia Post box or office.'
      };
    }

    if (isCanada) {
      return {
        carrier: 'Canada Post & Intelcom',
        rates: [
          { method: 'Expedited Parcel', time: '3–7 business days', cost: 'Free above C$100, otherwise C$9.99' },
          { method: 'Xpresspost', time: '1–3 business days', cost: 'Flat rate C$19.99' }
        ],
        details: 'Shipped from Toronto or Vancouver depending on proximity. Tracking code sent immediately upon shipping carrier scan.',
        returns: '30-day return window. Easy online return portal with pre-paid Canada Post shipping labels.'
      };
    }

    // Default (US / International)
    return {
      carrier: 'USPS, UPS & FedEx',
      rates: [
        { method: 'Standard Ground', time: '3–6 business days', cost: 'Free above $75, otherwise $5.99' },
        { method: 'FedEx Express', time: '1–3 business days', cost: 'Flat rate $15.00' }
      ],
      details: 'Orders are processed and shipped directly from the merchant\'s warehouse within 1–2 business days. Once dispatched, a tracking link will be sent to your email.',
      returns: 'Standard 30-day returns. Easy online portal access to print shipping labels. Items must be unworn and in original packaging.'
    };
  };

  const delivery = getDeliveryInfo();

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
                        <p style={{ marginBottom: 16, fontSize: 13.5, color: 'var(--ink)' }}>{product.description || "No description provided by merchant."}</p>
                        
                        <div style={{ 
                          background: 'var(--bg)', 
                          borderRadius: 12, 
                          padding: '16px', 
                          border: '1px solid var(--m-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink3)' }}>Material</span>
                            <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{material}</span>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink3)' }}>Fabric Care</span>
                            <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{getCareInstructions(material)}</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink3)' }}>Returns</span>
                            <span style={{ fontWeight: 500, color: 'var(--ink)' }}>
                              {isReturnable ? "Easy 30-Day Returns (via Loop)" : "Standard 30-Day Returns"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'sizeChart' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{ fontSize: 12, color: 'var(--ink3)' }}>
                            {category === 'footwear' ? 'Footwear size conversion guide:' : 'Sizing measurement guide:'}
                          </span>
                          {category !== 'other' && (
                            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--m-border)', borderRadius: 6, padding: 2 }}>
                              <button
                                onClick={() => setSizeUnit('in')}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  border: 'none',
                                  background: sizeUnit === 'in' ? 'var(--m-green)' : 'transparent',
                                  color: sizeUnit === 'in' ? '#fff' : 'var(--ink3)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {category === 'footwear' ? 'US' : 'IN'}
                              </button>
                              <button
                                onClick={() => setSizeUnit('cm')}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  border: 'none',
                                  background: sizeUnit === 'cm' ? 'var(--m-green)' : 'transparent',
                                  color: sizeUnit === 'cm' ? '#fff' : 'var(--ink3)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {category === 'footwear' ? 'EU' : 'CM'}
                              </button>
                            </div>
                          )}
                        </div>

                        {category === 'footwear' ? (
                          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--m-border)', borderRadius: 8 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', borderBottom: '1px solid var(--m-border)', zIndex: 1 }}>
                                <tr style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink3)' }}>
                                  <th style={{ padding: '8px 6px' }}>US M</th>
                                  <th style={{ padding: '8px 6px' }}>US W</th>
                                  <th style={{ padding: '8px 6px' }}>UK</th>
                                  <th style={{ padding: '8px 6px' }}>EU</th>
                                  <th style={{ padding: '8px 6px' }}>Length</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  { usm: '7.0', usw: '8.5', uk: '6.0', eu: '40', cm: '25.0', in: '9.8' },
                                  { usm: '8.0', usw: '9.5', uk: '7.0', eu: '41', cm: '26.0', in: '10.2' },
                                  { usm: '9.0', usw: '10.5', uk: '8.0', eu: '42.5', cm: '27.0', in: '10.6' },
                                  { usm: '10.0', usw: '11.5', uk: '9.0', eu: '44', cm: '28.0', in: '11.0' },
                                  { usm: '11.0', usw: '12.5', uk: '10.0', eu: '45', cm: '29.0', in: '11.4' },
                                  { usm: '12.0', usw: '13.5', uk: '11.0', eu: '46', cm: '30.0', in: '11.8' }
                                ].map((row, rIdx) => (
                                  <tr key={rIdx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                    <td style={{ padding: '8px 6px', fontWeight: sizeUnit === 'in' ? 700 : 500, color: sizeUnit === 'in' ? 'var(--m-green)' : 'var(--ink)' }}>{row.usm}</td>
                                    <td style={{ padding: '8px 6px', fontWeight: 500 }}>{row.usw}</td>
                                    <td style={{ padding: '8px 6px', fontWeight: 500 }}>{row.uk}</td>
                                    <td style={{ padding: '8px 6px', fontWeight: sizeUnit === 'cm' ? 700 : 500, color: sizeUnit === 'cm' ? 'var(--m-green)' : 'var(--ink)' }}>{row.eu}</td>
                                    <td style={{ padding: '8px 6px', color: 'var(--ink3)' }}>{row.cm} cm / {row.in}"</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : category === 'apparel' ? (
                          <div style={{ border: '1px solid var(--m-border)', borderRadius: 8, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                              <thead style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--m-border)' }}>
                                <tr style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink3)' }}>
                                  <th style={{ padding: '8px 12px' }}>Size</th>
                                  {isBottoms ? (
                                    <>
                                      <th style={{ padding: '8px 6px' }}>Waist</th>
                                      <th style={{ padding: '8px 6px' }}>Inseam</th>
                                      <th style={{ padding: '8px 6px' }}>Hip</th>
                                    </>
                                  ) : (
                                    <>
                                      <th style={{ padding: '8px 6px' }}>Chest</th>
                                      <th style={{ padding: '8px 6px' }}>Waist</th>
                                      <th style={{ padding: '8px 6px' }}>Length</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {isBottoms ? (
                                  sizeUnit === 'in' ? (
                                    [
                                      { sz: 'XS (28)', wa: '28" - 29"', ins: '30"', hp: '34" - 35"' },
                                      { sz: 'S (30)', wa: '30" - 31"', ins: '30"', hp: '36" - 37"' },
                                      { sz: 'M (32)', wa: '32" - 33"', ins: '32"', hp: '38" - 39"' },
                                      { sz: 'L (34)', wa: '34" - 35"', ins: '32"', hp: '40" - 41"' },
                                      { sz: 'XL (36)', wa: '36" - 38"', ins: '34"', hp: '42" - 44"' },
                                      { sz: 'XXL (38)', wa: '38" - 40"', ins: '34"', hp: '44" - 46"' }
                                    ].map((row, rIdx) => (
                                      <tr key={rIdx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--ink)' }}>{row.sz}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.wa}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.ins}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.hp}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    [
                                      { sz: 'XS (28)', wa: '71 - 74 cm', ins: '76 cm', hp: '86 - 89 cm' },
                                      { sz: 'S (30)', wa: '76 - 79 cm', ins: '76 cm', hp: '91 - 94 cm' },
                                      { sz: 'M (32)', wa: '81 - 84 cm', ins: '81 cm', hp: '96 - 99 cm' },
                                      { sz: 'L (34)', wa: '86 - 89 cm', ins: '81 cm', hp: '101 - 104 cm' },
                                      { sz: 'XL (36)', wa: '91 - 96 cm', ins: '86 cm', hp: '106 - 112 cm' },
                                      { sz: 'XXL (38)', wa: '96 - 101 cm', ins: '86 cm', hp: '112 - 117 cm' }
                                    ].map((row, rIdx) => (
                                      <tr key={rIdx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--ink)' }}>{row.sz}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.wa}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.ins}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.hp}</td>
                                      </tr>
                                    ))
                                  )
                                ) : (
                                  sizeUnit === 'in' ? (
                                    [
                                      { sz: 'S', ch: '35" - 37"', wa: '29" - 31"', len: '28"' },
                                      { sz: 'M', ch: '38" - 40"', wa: '32" - 34"', len: '29"' },
                                      { sz: 'L', ch: '41" - 43"', wa: '35" - 37"', len: '30"' },
                                      { sz: 'XL', ch: '44" - 46"', wa: '38" - 40"', len: '31"' },
                                      { sz: 'XXL', ch: '47" - 49"', wa: '41" - 43"', len: '32"' }
                                    ].map((row, rIdx) => (
                                      <tr key={rIdx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--ink)' }}>{row.sz}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.ch}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.wa}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.len}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    [
                                      { sz: 'S', ch: '89 - 94 cm', wa: '74 - 79 cm', len: '71 cm' },
                                      { sz: 'M', ch: '96 - 102 cm', wa: '81 - 86 cm', len: '74 cm' },
                                      { sz: 'L', ch: '104 - 109 cm', wa: '89 - 94 cm', len: '76 cm' },
                                      { sz: 'XL', ch: '112 - 117 cm', wa: '96 - 102 cm', len: '79 cm' },
                                      { sz: 'XXL', ch: '119 - 124 cm', wa: '104 - 109 cm', len: '81 cm' }
                                    ].map((row, rIdx) => (
                                      <tr key={rIdx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--ink)' }}>{row.sz}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.ch}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.wa}</td>
                                        <td style={{ padding: '8px 6px' }}>{row.len}</td>
                                      </tr>
                                    ))
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--m-border)' }}>
                            <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>📏</span>
                            <h4 style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>One Size / Universal Fit</h4>
                            <p style={{ fontSize: 13, color: 'var(--ink2)', margin: 0, lineHeight: 1.5 }}>
                              This product is designed as a universal one-size fit. Adjustable components cover standard adult dimensions.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'shipping' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Shipping Rates Box */}
                        <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px', border: '1px solid var(--m-border)' }}>
                          <h4 style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                            🚚 Shipping Methods & Rates
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {delivery.rates.map((rate, rIdx) => (
                              <div key={rIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: rIdx < delivery.rates.length - 1 ? '1px solid rgba(0,0,0,0.03)' : 'none', paddingBottom: rIdx < delivery.rates.length - 1 ? 8 : 0 }}>
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>{rate.method}</div>
                                  <div style={{ fontSize: 12, color: 'var(--ink3)' }}>Est. Delivery: {rate.time}</div>
                                </div>
                                <div style={{ fontWeight: 600, color: 'var(--m-green)', fontSize: 13 }}>{rate.cost}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Dispatch Details */}
                        <div>
                          <h4 style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                            📦 Fulfillment Partners
                          </h4>
                          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink2)' }}>
                            Shipped via <strong>{delivery.carrier}</strong>. {delivery.details}
                          </p>
                        </div>

                        {/* Returns & Exchange info */}
                        <div>
                          <h4 style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                            🔄 Returns & Exchanges
                          </h4>
                          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink2)' }}>
                            {delivery.returns}
                          </p>
                        </div>
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
