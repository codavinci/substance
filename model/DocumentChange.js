import clone from '../util/clone'
import cloneDeep from '../util/cloneDeep'
import forEach from '../util/forEach'
import getKeyForPath from '../util/getKeyForPath'
import isPlainObject from '../util/isPlainObject'
import isString from '../util/isString'
import _isDefined from '../util/_isDefined'
import uuid from '../util/uuid'
import OperationSerializer from './OperationSerializer'
import ObjectOperation from './ObjectOperation'
import { fromJSON as selectionFromJSON } from './selectionHelpers'
import { getContainerPosition } from './documentHelpers'

export default class DocumentChange {
  constructor (ops, before, after, info = {}) {
    if (arguments.length === 1 && isPlainObject(arguments[0])) {
      const data = arguments[0]
      // a unique id for the change
      this.sha = data.sha
      // when the change has been applied
      this.timestamp = data.timestamp
      // application state before the change was applied
      this.before = data.before || {}
      this.info = data.info // custom change info
      // application state after the change was applied
      this.after = data.after || {}
      // array of operations
      this.ops = data.ops || []
    } else {
      this.sha = uuid()
      this.info = info
      this.timestamp = Date.now()
      this.before = before || {}
      this.after = after || {}
      this.ops = ops.slice(0)
    }
    // a hash with all updated properties
    this.updated = null
    // a hash with all created nodes
    this.created = null
    // a hash with all deleted nodes
    this.deleted = null
  }

  get primitiveOps () {
    // TODO: we might want to introduce higher-level ops
    // using change.primitiveOps instead of change.ops
    // allows us to do this move seemlessly
    return this.ops
  }

  /*
    Extract aggregated information about which nodes and properties have been affected.
    This gets called by Document after applying the change.
  */
  _extractInformation (doc) {
    // TODO: we should instead clean-up EditorSession et. al
    // For now we allow this method to be called multiple times, but only extract the details the first time
    if (this._extracted) return

    const primitiveOps = this.primitiveOps
    const created = {}
    const deleted = {}
    const updated = {}
    const affectedContainerAnnos = []

    // TODO: we will introduce a special operation type for coordinates
    function _checkAnnotation (op) {
      switch (op.type) {
        case 'create':
        case 'delete': {
          const node = op.val
          if (_isDefined(node.start) && node.start.path) {
            updated[getKeyForPath(node.start.path)] = true
          }
          if (_isDefined(node.end) && node.end.path) {
            updated[getKeyForPath(node.end.path)] = true
          }
          break
        }
        case 'update':
        case 'set': {
          // HACK: detecting annotation changes in an opportunistic way
          const node = doc.get(op.path[0])
          if (node) {
            if (node.isPropertyAnnotation()) {
              updated[getKeyForPath(node.start.path)] = true
            } else if (node.isContainerAnnotation()) {
              affectedContainerAnnos.push(node)
            }
          }
          break
        }
        default:
          /* istanbul ignore next */
          // NOP
      }
    }

    for (const op of primitiveOps) {
      if (op.type === 'create') {
        created[op.val.id] = op.val
        delete deleted[op.val.id]
      }
      if (op.type === 'delete') {
        delete created[op.val.id]
        deleted[op.val.id] = op.val
      }
      if (op.type === 'set' || op.type === 'update') {
        updated[getKeyForPath(op.path)] = true
        // also mark the node itself as dirty
        updated[op.path[0]] = true
      }
      _checkAnnotation(op)
    }

    affectedContainerAnnos.forEach(anno => {
      const startPos = getContainerPosition(doc, anno.containerPath, anno.start.path[0])
      const endPos = getContainerPosition(doc, anno.containerPath, anno.end.path[0])
      const nodeIds = doc.get(anno.containerPath)
      for (let pos = startPos; pos <= endPos; pos++) {
        const node = doc.get(nodeIds[pos])
        let path
        if (node.isText()) {
          path = node.getPath()
        } else {
          path = [node.id]
        }
        if (!deleted[node.id]) {
          updated[getKeyForPath(path)] = true
        }
      }
    })

    // remove all deleted nodes from updated
    if (Object.keys(deleted).length > 0) {
      forEach(updated, function (_, key) {
        const nodeId = key.split('.')[0]
        if (deleted[nodeId]) {
          delete updated[key]
        }
      })
    }

    this.created = created
    this.deleted = deleted
    this.updated = updated

    this._extracted = true
  }

  invert () {
    // shallow cloning this
    const copy = this.toJSON()
    copy.ops = []
    // swapping before and after
    const tmp = copy.before
    copy.before = copy.after
    copy.after = tmp
    const inverted = DocumentChange.fromJSON(copy)
    // ATTENTION: inverted ops need to be in reverse order
    inverted.ops = this.primitiveOps.map(op => op.invert()).reverse()
    return inverted
  }

  hasUpdated (path) {
    let key
    if (isString(path)) {
      key = path
    } else {
      key = getKeyForPath(path)
    }
    return this.updated[key]
  }

  hasDeleted (id) {
    return this.deleted[id]
  }

  serialize () {
    const opSerializer = new OperationSerializer()
    const data = this.toJSON()
    data.ops = this.ops.map(op => opSerializer.serialize(op))
    return JSON.stringify(data)
  }

  clone () {
    return DocumentChange.fromJSON(this.toJSON())
  }

  toJSON () {
    const data = {
      // to identify this change
      sha: this.sha,
      // before state
      before: clone(this.before),
      ops: this.ops.map(op => op.toJSON()),
      info: this.info,
      // after state
      after: clone(this.after)
    }

    // Just to make sure rich selection objects don't end up
    // in the JSON result
    data.after.selection = undefined
    data.before.selection = undefined

    let sel = this.before.selection
    if (sel && sel._isSelection) {
      data.before.selection = sel.toJSON()
    }
    sel = this.after.selection
    if (sel && sel._isSelection) {
      data.after.selection = sel.toJSON()
    }
    return data
  }

  static deserialize (str) {
    const opSerializer = new OperationSerializer()
    const data = JSON.parse(str)
    data.ops = data.ops.map(opData => opSerializer.deserialize(opData))
    if (data.before.selection) {
      data.before.selection = selectionFromJSON(data.before.selection)
    }
    if (data.after.selection) {
      data.after.selection = selectionFromJSON(data.after.selection)
    }
    return new DocumentChange(data)
  }

  static fromJSON (data) {
    // Don't write to original object on deserialization
    data = cloneDeep(data)
    data.ops = data.ops.map(opData => ObjectOperation.fromJSON(opData))
    data.before.selection = selectionFromJSON(data.before.selection)
    data.after.selection = selectionFromJSON(data.after.selection)
    return new DocumentChange(data)
  }
}
