export type Locale = {
  meta: {
    title: string
    description: string
  }
  nav: {
    docs: string
    github: string
    langSwitch: { label: string; href: string }
  }
  hero: {
    eyebrow: string
    h1Line1: string
    h1Em: string
    sub: string
    tagline: string
    ctaPrimary: string
    ctaSecondary: string
    graphAriaLabel: string
    graphMeta: [string, string]
    graph: {
      mastery: string
      knowledge: string
      inquiry: string
      memorization: string
      mind: string
      understanding: string
      produces: string
      subtypeOf: string
      requires: string
      contrastsWith: string
      occursIn: string
      underlineHw: {
        mastery: number
        knowledge: number
        inquiry: number
        memorization: number
        mind: number
        understanding: number
      }
    }
  }
  principles: {
    label: string
    p1: {
      heading: string
      body: string
      chat: {
        userMsg: string
        mentorMsg: string
        inputPlaceholder: string
      }
    }
    p2: {
      heading: string
      body: string
      module1: string
      module2: string
      module3: string
    }
    p3: {
      heading: string
      body: string
      aiMode: string
      settings: string
      local: string
      localMeta: string
      remote: string
      remoteMeta: string
    }
  }
  vocab: {
    label: string
    intro: string
    ctaLink: string
    categories: {
      taxonomic: { name: string; q: string; nodeA: string; nodeB: string }
      structural: { name: string; q: string; nodeA: string; nodeB: string }
      causal: { name: string; q: string; nodeA: string; nodeB: string }
      dependency: { name: string; q: string; nodeA: string; nodeB: string }
      temporal: { name: string; q: string; nodeA: string; nodeB: string }
      opposition: { name: string; q: string; nodeA: string; nodeB: string }
      similarity: { name: string; q: string; nodeA: string; nodeB: string }
    }
    edges: {
      subtypeOf: string
      contains: string
      produces: string
      requires: string
      precedes: string
      oppositeOf: string
      similarTo: string
    }
    chips: {
      taxonomic: string[]
      structural: string[]
      causal: string[]
      dependency: string[]
      temporal: string[]
      opposition: string[]
      similarity: string[]
    }
  }
  credo: {
    line1: string
    line1Em: string
    line2: string
    line2Em: string
    line3: string
    line3Em: string
    ctaPrimary: string
    ctaSecondary: string
  }
  footer: {
    copyright: string
    docs: string
    github: string
    app: string
  }
}
