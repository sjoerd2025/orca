import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * A Back control the page serves is reachable by name or not at all. Inside the shell there is no
 * native chrome behind it, so a bare Pressable is absent from the accessibility tree: a screen
 * reader has nothing to announce and an automation harness has nothing to find. The C2.7 device
 * proof located the tasks Back only by tapping the native control's coordinates.
 *
 * The oracle is the house's Back affordance — a Pressable rendering a ChevronLeft that either
 * carries the back-button style or calls back. A Back control drawn some other way is invisible to
 * it, which is why the table below names one screen tree per page route instead of trusting a scan
 * to find the screens on its own.
 */
const MOBILE_ROOT = join(import.meta.dirname, '..', '..')
const PAGE_ROUTE_REGISTRY = join(
  MOBILE_ROOT,
  '..',
  'config',
  'scripts',
  'mobile-web-page-routes.mjs'
)

/** One entry per route in MOBILE_WEB_PAGE_ROUTES: the tree whose chrome that route serves. */
const PAGE_SERVED_SCREENS = [
  { pathname: '/h/[hostId]', tree: 'src/host-screen' },
  { pathname: '/h/[hostId]/agent-history/[worktreeId]', tree: 'src/agent-history' },
  { pathname: '/h/[hostId]/tasks', tree: 'src/tasks' }
]

const PRESSABLE_TAGS = new Set(['Pressable', 'TouchableOpacity'])
const GOES_BACK = /\.back\(\)|\brequestBack\b/

type BackControl = { path: string; line: number; role: string; label: string }

function componentFiles(tree: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(join(MOBILE_ROOT, tree), { withFileTypes: true })) {
    const path = `${tree}/${entry.name}`
    if (entry.isDirectory()) {
      found.push(...componentFiles(path))
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      found.push(path)
    }
  }
  return found
}

function attribute(element: ts.JsxOpeningLikeElement, name: string): string {
  for (const property of element.attributes.properties) {
    if (ts.isJsxAttribute(property) && property.name.getText() === name) {
      const initializer = property.initializer
      if (!initializer) {
        return ''
      }
      return ts.isStringLiteral(initializer) ? initializer.text : initializer.getText()
    }
  }
  return ''
}

function rendersChevronLeft(element: ts.JsxElement): boolean {
  let found = false
  function visit(node: ts.Node): void {
    if (found) {
      return
    }
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText() === 'ChevronLeft'
    ) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  for (const child of element.children) {
    visit(child)
  }
  return found
}

function backControlsIn(path: string): BackControl[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(join(MOBILE_ROOT, path), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const found: BackControl[] = []
  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node) && PRESSABLE_TAGS.has(node.openingElement.tagName.getText())) {
      const opening = node.openingElement
      const style = attribute(opening, 'style')
      const press = attribute(opening, 'onPress')
      if (rendersChevronLeft(node) && (style.includes('backButton') || GOES_BACK.test(press))) {
        found.push({
          path,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          role: attribute(opening, 'accessibilityRole'),
          label: attribute(opening, 'accessibilityLabel')
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function backControlsUnder(tree: string): BackControl[] {
  return componentFiles(tree).flatMap((path) => backControlsIn(path))
}

function describeControl(control: BackControl): string {
  return `${control.path}:${control.line} role=${control.role || 'none'} label=${
    control.label || 'none'
  }`
}

function registeredPathnames(): string[] {
  return [...readFileSync(PAGE_ROUTE_REGISTRY, 'utf8').matchAll(/pathname: '([^']+)'/g)]
    .map((match) => match[1])
    .sort()
}

const CONTROLS = PAGE_SERVED_SCREENS.flatMap((screen) => backControlsUnder(screen.tree))

describe('Back controls in the screens the page serves', () => {
  it('covers every page route and finds a control in each, so the rules below cannot pass vacuously', () => {
    // A route listed in MOBILE_WEB_PAGE_ROUTES with no entry above is a screen this rule never
    // reads. The list grows in the PR that registers the route, as the flag census's does.
    expect(registeredPathnames()).toEqual(
      PAGE_SERVED_SCREENS.map((screen) => screen.pathname).sort()
    )
    for (const screen of PAGE_SERVED_SCREENS) {
      expect({ [screen.tree]: backControlsUnder(screen.tree).map(describeControl) }).not.toEqual({
        [screen.tree]: []
      })
    }
  })

  it('gives every one of them the button role', () => {
    expect(CONTROLS.filter((control) => control.role !== 'button').map(describeControl)).toEqual([])
  })

  it('names every one of them in the app’s own wording for Back', () => {
    expect(
      CONTROLS.filter((control) => !/^Back\b/.test(control.label)).map(describeControl)
    ).toEqual([])
  })
})
