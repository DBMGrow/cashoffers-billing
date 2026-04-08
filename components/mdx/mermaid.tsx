'use client';

import { use, useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

export function Mermaid({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return;
  return <MermaidContent chart={chart} />;
}

const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(key: string, setPromise: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;

  const promise = setPromise();
  cache.set(key, promise);
  return promise;
}

const themeVars = {
  light: {
    primaryColor: 'hsl(210, 40%, 96%)',
    primaryTextColor: '#112f45',
    primaryBorderColor: 'hsla(210, 30%, 75%, 70%)',
    lineColor: '#4d9cb9',
    secondaryColor: 'hsl(210, 40%, 94%)',
    secondaryTextColor: '#112f45',
    secondaryBorderColor: 'hsla(210, 30%, 75%, 70%)',
    tertiaryColor: 'hsl(210, 40%, 98%)',
    tertiaryTextColor: '#112f45',
    tertiaryBorderColor: 'hsla(210, 30%, 75%, 70%)',
    background: 'transparent',
    mainBkg: 'hsl(210, 40%, 96%)',
    nodeBorder: 'hsla(210, 30%, 75%, 70%)',
    clusterBkg: 'hsl(210, 40%, 97%)',
    clusterBorder: 'hsla(210, 30%, 80%, 60%)',
    titleColor: '#112f45',
    edgeLabelBackground: 'hsl(0, 0%, 100%)',
    fontFamily: 'inherit',
    fontSize: '13px',
    // Special nodes (start/end circles, decision diamonds)
    specialStateColor: '#4d9cb9',
    labelColor: '#112f45',
    attributeBackgroundColorOdd: 'hsl(210, 40%, 97%)',
    attributeBackgroundColorEven: 'hsl(210, 40%, 94%)',
  },
  dark: {
    primaryColor: 'hsl(215, 25%, 20%)',
    primaryTextColor: 'hsl(210, 40%, 90%)',
    primaryBorderColor: 'hsla(210, 25%, 35%, 60%)',
    lineColor: '#5dafe0',
    secondaryColor: 'hsl(215, 25%, 18%)',
    secondaryTextColor: 'hsl(210, 40%, 90%)',
    secondaryBorderColor: 'hsla(210, 25%, 35%, 60%)',
    tertiaryColor: 'hsl(215, 28%, 16%)',
    tertiaryTextColor: 'hsl(210, 40%, 90%)',
    tertiaryBorderColor: 'hsla(210, 25%, 35%, 60%)',
    background: 'transparent',
    mainBkg: 'hsl(215, 25%, 20%)',
    nodeBorder: 'hsla(210, 25%, 35%, 60%)',
    clusterBkg: 'hsl(215, 25%, 16%)',
    clusterBorder: 'hsla(210, 25%, 30%, 50%)',
    titleColor: 'hsl(210, 40%, 90%)',
    edgeLabelBackground: 'hsl(215, 30%, 12%)',
    fontFamily: 'inherit',
    fontSize: '13px',
    specialStateColor: '#5dafe0',
    labelColor: 'hsl(210, 40%, 90%)',
    attributeBackgroundColorOdd: 'hsl(215, 25%, 18%)',
    attributeBackgroundColorEven: 'hsl(215, 25%, 16%)',
  },
} as const;

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { default: mermaid } = use(cachePromise('mermaid', () => import('mermaid')));

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    themeVariables: isDark ? themeVars.dark : themeVars.light,
  });

  const { svg, bindFunctions } = use(
    cachePromise(`${chart}-${resolvedTheme}`, () => {
      return mermaid.render(id, chart.replaceAll('\\n', '\n'));
    }),
  );

  return (
    <div
      ref={(container) => {
        if (container) bindFunctions?.(container);
      }}
      className="not-prose my-6 overflow-x-auto rounded-xl border border-[hsla(210,30%,85%,60%)] bg-[hsl(210,40%,98%)] p-6 dark:border-[hsla(210,25%,30%,50%)] dark:bg-[hsl(215,28%,14%)]"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
