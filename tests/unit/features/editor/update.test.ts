import { describe, expect, it } from 'vitest'
import { insertAt, move, removeAt, setIn } from '~/features/editor/update'
import { buildCv, buildProject } from '../../../fixtures/cv'

describe('setIn', () => {
  it('should return a new object with only the target path changed', () => {
    const cv = buildCv()

    const next = setIn(cv, ['basics', 'label'], 'Principal Architect')

    expect(next.basics.label).toBe('Principal Architect')
    expect(cv.basics.label).toBe('Software Architect')
    expect(next.projects).toBe(cv.projects)
    expect(next).not.toBe(cv)
  })

  it('should set a field inside an array item without touching siblings', () => {
    const cv = buildCv({ projects: [buildProject({ name: 'A' }), buildProject({ name: 'B' })] })

    const next = setIn(cv, ['projects', 1, 'name'], 'B2')

    expect(next.projects.map((p) => p.name)).toEqual(['A', 'B2'])
    expect(next.projects[0]).toBe(cv.projects[0])
  })

  it('should remove an optional string when it becomes empty', () => {
    const cv = buildCv({ basics: { 'x-tagline': 'Calm focus' } })

    const next = setIn(cv, ['basics', 'x-tagline'], '')

    expect('x-tagline' in next.basics).toBe(false)
  })

  it('should keep a required string as empty text when it is cleared', () => {
    const cv = buildCv({ projects: [buildProject()] })

    const next = setIn(cv, ['projects', 0, 'name'], '')

    expect(next.projects[0]?.name).toBe('')
  })

  it('should remove an optional array when it becomes empty', () => {
    const cv = buildCv({ projects: [buildProject({ keywords: ['Scrum'] })] })

    const next = setIn(cv, ['projects', 0, 'keywords'], [])

    expect('keywords' in (next.projects[0] ?? {})).toBe(false)
  })

  it('should keep a required array as [] when it becomes empty', () => {
    const cv = buildCv({ projects: [buildProject()] })

    const next = setIn(cv, ['projects'], [])

    expect(next.projects).toEqual([])
  })

  it('should remove an optional value when it is set to undefined', () => {
    const cv = buildCv({ projects: [buildProject({ 'x-highlight': true })] })

    const next = setIn(cv, ['projects', 0, 'x-highlight'], undefined)

    expect('x-highlight' in (next.projects[0] ?? {})).toBe(false)
  })
})

describe('list helpers', () => {
  it('should insert an item at the index without mutating the input', () => {
    const list = ['a', 'c'] as const

    expect(insertAt(list, 1, 'b')).toEqual(['a', 'b', 'c'])
    expect(list).toEqual(['a', 'c'])
  })

  it('should remove the item at the index', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })

  it('should move an item from one index to another', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
  })

  it('should return the same list when a move is out of range', () => {
    const list = ['a', 'b']

    expect(move(list, 1, 2)).toBe(list)
    expect(move(list, -1, 0)).toBe(list)
  })
})
