// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://nesso.how',
	integrations: [
		starlight({
			title: 'Nesso',
			description: 'An AI-powered knowledge graph for active learning.',
			favicon: '/icon/favicon.svg',
			logo: {
				light: './src/assets/logo-light.svg',
				dark: './src/assets/logo-dark.svg',
				alt: 'Nesso',
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/cedoor/nesso' },
			],
			customCss: ['./src/styles/custom.css'],
			head: [
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' } },
				{ tag: 'link', attrs: { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500;1,9..144,600&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;450;500;600&display=swap' } },
			],
			sidebar: [
				{
					label: 'Guides',
					items: [
						{ label: 'Getting started', slug: 'docs/guides/getting-started' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Edge types', slug: 'docs/reference/edge-types' },
					],
				},
			],
		}),
	],
});
