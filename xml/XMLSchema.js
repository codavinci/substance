import { forEach, last } from '../util'
import DFA from './DFA'

const { TEXT, EPSILON, START } = DFA

export default class XMLSchema {

  constructor(elementSchemas) {
    this._elementSchemas = {}
    forEach(elementSchemas, (spec, name) => {
      this._elementSchemas[name] = new ElementSchema(this, spec)
    })
  }

  getTagNames() {
    return Object.keys(this._elementSchemas)
  }

  getElementSchema(name) {
    return this._elementSchemas[name]
  }

  getStartElement() {
    // TODO: we should extract this from RNG
    // for now you must override this method
    throw new Error('This method is abstract')
  }
}

class ElementSchema {

  constructor(xmlSchema, { name, type, attributes, dfa}) {
    this.xmlSchema = xmlSchema
    this.name = name
    this.type = type
    this.attributes = attributes
    this.dfa = dfa

    this._initialize()
  }

  // EXPERIMENTAL: reflection API which is used
  // to inhibit commands considering the current
  // selection state
  // This works only for ContainerNodes and TextNodes
  // where order on the children is not restricted

  _initialize() {
    // Note: collecting all children
    const children = {}
    forEach(this.dfa.transitions, (T) => {
      Object.keys(T).forEach((tagName) => {
        if (tagName === TEXT) {
          this._canContainText = true
          return
        }
        if (tagName === EPSILON) return
        children[tagName] = true
      })
    })
    this._allowedChildren = children
  }

  isAllowed(tagName) {
    return Boolean(this._allowedChildren[tagName])
  }

  isTextAllowed() {
    return Boolean(this._canContainText)
  }

  // EXPERIMENTAL:
  // can be used for a 'prependChild' or for displaying helpful validator error messages
  findFirstValidPos(el, newTag) {
    let candidates = this._findInsertPosCandidates(el, newTag)
    if (candidates.length > 0) {
      return candidates[0]
    } else {
      return -1
    }
  }

  // EXPERIMENTAL:
  // we want to provide a high-level API `node.append()`
  // which looks for the last valid position according to the element schema
  findLastValidPos(el, newTag) {
    let candidates = this._findInsertPosCandidates(el, newTag)
    if (candidates.length > 0) {
      return last(candidates)
    } else {
      return -1
    }
  }

  _findInsertPosCandidates(el, newTag) {
    const childNodes = el.getChildNodes()
    const tagName = this.name
    const dfa = this.dfa
    let candidates = []
    let state = START
    let pos = 0
    for (;pos < childNodes.length; pos++) {
      if (dfa.canConsume(state, newTag)) {
        candidates.push(pos)
      }
      const child = childNodes[pos]
      let token
      if (child.isTextNode()) {
        if (/^\s*$/.exec(child.textContent)) {
          continue
        }
        token = TEXT
      } else if (child.isElementNode()) {
        token = child.tagName
      } else {
        continue
      }
      let nextState = dfa.consume(state, token)
      if (nextState === -1) {
        console.error('Element is invalid:', el)
        throw new Error(`Element <${tagName}> is invalid.`)
      }
      state = nextState
    }
    // also consider the position after all previous siblings
    if (dfa.canConsume(state, newTag)) {
      candidates.push(pos)
    }
    return candidates
  }
}
