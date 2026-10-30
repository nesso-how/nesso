import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePluginEntry, validateActions } from '../src/module.ts'
import { PluginError } from '../src/runtime.ts'

test('local actions require exactly one run callback or UI component', () => {
  const descriptor = { id: 'example', label: { en: 'Example' } }
  validateActions([{ ...descriptor, run: () => {} }, { ...descriptor, ui: () => null }])
  for (const action of [null, descriptor, { ...descriptor, ui: true }, { ...descriptor, run: true }, { ...descriptor, run: () => {}, ui: () => null }]) {
    assert.throws(() => validateActions([action]), PluginError)
  }
})

test('React imports share one runtime without rewriting strings or bundled headless actions', async () => {
  const runtime = `data:text/javascript,${encodeURIComponent('export const React={default:{version:"test"},version:"test"};export const JSXRuntime={jsx:()=>null};')}`
  const entry = (code: string) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  const bundled = entry('export const create=()=>[];')
  assert.equal(await resolvePluginEntry(bundled, runtime), bundled)
  const url = await resolvePluginEntry(entry(`
    import React, {version} from 'react';
    import {jsx} from 'react/jsx-runtime';
    export const literal="from 'react'";
    export const same=React.version===version;
    export const dynamic=()=>import('react');
    export const element=jsx();
  `), runtime)
  const module = await import(url)
  assert.equal(module.literal, "from 'react'")
  assert.equal(module.same, true)
  assert.equal((await module.dynamic()).version, 'test')
  assert.equal(module.element, null)
})
