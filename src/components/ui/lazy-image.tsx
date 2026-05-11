'use client'

import { useState, useRef, useEffect, CSSProperties, ImgHTMLAttributes } from 'react'

interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onLoad'> {
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
  /** Distance from viewport to start loading (default: '300px') */
  rootMargin?: string
  /** Min-height placeholder before image loads (default: 80) */
  placeholderHeight?: number
}

export function LazyImage({
  src,
  alt = '',
  className = '',
  style,
  rootMargin = '300px',
  placeholderHeight = 80,
  ...rest
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const [inView, setInView] = useState(false)
  const sentinelRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  if (errored) return null

  return (
    <img
      {...rest}
      ref={sentinelRef}
      src={inView ? src : undefined}
      alt={alt}
      className={`${className} transition-opacity duration-500`}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        minHeight: loaded ? undefined : placeholderHeight,
        background: loaded ? undefined : 'linear-gradient(135deg, rgba(120,120,120,0.06) 0%, rgba(120,120,120,0.12) 50%, rgba(120,120,120,0.06) 100%)',
      }}
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
      draggable={false}
    />
  )
}
