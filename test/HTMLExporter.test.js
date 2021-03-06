import { test as substanceTest } from 'substance-test'
import { DefaultDOMElement, MemoryDOMElement, platform } from 'substance'
import createTestArticle from './shared/createTestArticle'
import getTestConfig from './shared/getTestConfig'
import simple from './fixture/simple'

const CONTENT = '0123456789'

htmlExporterTests()

if (platform.inBrowser) {
  htmlExporterTests('memory')
}

function htmlExporterTests (memory) {
  const LABEL = 'HTMLExporter' + (memory ? ' [memory]' : '')
  const test = (title, fn) => substanceTest(`${LABEL}: ${title}`, t => {
    // before
    t.elementFactory = memory ? MemoryDOMElement.createDocument('html') : DefaultDOMElement.createDocument('html')
    fn(t)
  })

  test('Exporting paragraph', function (t) {
    const { doc, exporter } = setup(t)
    const p1 = doc.create({ type: 'paragraph', id: 'p1', content: CONTENT })
    const el = exporter.convertNode(p1)
    const actual = el.outerHTML
    const expected = '<p data-id="p1">' + CONTENT + '</p>'
    t.equal(actual, expected, 'Exported HTML should be correct')
    t.end()
  })

  test('Exporting paragraph with strong', function (t) {
    const { doc, exporter } = setup(t)
    const p1 = doc.create({ type: 'paragraph', id: 'p1', content: CONTENT })
    doc.create({
      type: 'strong',
      id: 's1',
      start: {
        path: ['p1', 'content'],
        offset: 4
      },
      end: {
        offset: 7
      }
    })
    const el = exporter.convertNode(p1)
    const actual = el.outerHTML
    const expected = '<p data-id="p1">0123<strong data-id="s1">456</strong>789</p>'
    t.equal(actual, expected, 'Exported HTML should be correct')
    t.end()
  })

  test('Exporting h1', function (t) {
    const { doc, exporter } = setup(t)
    const h1 = doc.create({ type: 'heading', id: 'h1', level: 1, content: CONTENT })
    const el = exporter.convertNode(h1)
    const actual = el.outerHTML
    const expected = '<h1 data-id="h1">' + CONTENT + '</h1>'
    t.equal(actual, expected, 'Exported HTML should be correct')
    t.end()
  })

  test('Exporting h2', function (t) {
    const { doc, exporter } = setup(t)
    const h2 = doc.create({ type: 'heading', id: 'h2', level: 2, content: CONTENT })
    const el = exporter.convertNode(h2)
    const actual = el.outerHTML
    const expected = '<h2 data-id="h2">' + CONTENT + '</h2>'
    t.equal(actual, expected, 'Exported HTML should be correct')
    t.end()
  })

  test('Exporting simple document', function (t) {
    const { doc, exporter } = setup(t, simple)
    const el = exporter.exportDocument(doc)
    const actual = el.html()
    const expected = [
      '<p data-id="p1">' + CONTENT + '</p>',
      '<p data-id="p2">' + CONTENT + '</p>',
      '<p data-id="p3">' + CONTENT + '</p>',
      '<p data-id="p4">' + CONTENT + '</p>'
    ].join('')
    t.equal(actual, expected, 'Exported HTML should be correct')
    t.end()
  })

  test('Exporting a link', function (t) {
    const { doc, exporter } = setup(t)
    const p1 = doc.create({ type: 'paragraph', id: 'p1', content: CONTENT })
    doc.create({
      type: 'link',
      id: 'l1',
      start: {
        path: ['p1', 'content'],
        offset: 4
      },
      end: {
        offset: 7
      },
      href: 'foo'
    })
    const el = exporter.convertNode(p1)
    const childNodes = el.getChildNodes()
    t.equal(childNodes.length, 3, 'Exported paragraph should have 3 child nodes')
    t.equal(childNodes[0].textContent, '0123', '.. 1. should have correct text')
    t.equal(childNodes[1].textContent, '456', '.. 2. should have correct text')
    t.equal(childNodes[2].textContent, '789', '.. 3. should have correct text')
    const a = childNodes[1]
    t.equal(a.attr('data-id'), 'l1', '.. <a> should have data-id set')
    t.equal(a.attr('href'), 'foo', '.. and correct href attribute')
    t.end()
  })

  test('Exporting an unordered list', function (t) {
    const { doc, exporter } = setup(t)
    const l1 = _l1(doc)
    const el = exporter.convertNode(l1)
    const childNodes = el.getChildNodes()
    t.equal(el.tagName, 'ul', 'Exported element should be a <ul>')
    t.equal(el.attr('data-id'), 'l1', '.. with correct id')
    t.equal(childNodes.length, 2, '.. and two child nodes')
    t.equal(childNodes[0].tagName, 'li', '.. a <li>')
    t.equal(childNodes[0].textContent, 'Foo', ".. with content 'Foo'")
    t.equal(childNodes[1].tagName, 'li', '.. and a <li>')
    t.equal(childNodes[1].textContent, 'Bar', ".. with content 'Bar'")
    t.end()
  })

  test('Exporting an ordered list', function (t) {
    const { doc, exporter } = setup(t)
    const ol = doc.create({
      type: 'list',
      id: 'ol1',
      listType: 'order'
    })
    const el = exporter.convertNode(ol)
    t.equal(el.tagName, 'ol', 'Exported element should be a <ol>')
    t.end()
  })

  test('Exporting a nested list', function (t) {
    const { doc, exporter } = setup(t)
    const l = _l2(doc)
    const el = exporter.convertNode(l)
    const items = el.findAll('li')
    const nestedList = el.find('ul')
    t.equal(items.length, 4, 'Exported should contain 4 list items')
    t.notNil(nestedList, '.. and a nested list')
    t.equal(nestedList.childNodes.length, 2, '.. which has 2 child nodes')
    t.end()
  })

  function setup (t, fixture) {
    const config = getTestConfig()
    const exporter = config.createExporter('html', {}, { elementFactory: t.elementFactory })
    const doc = createTestArticle(fixture)
    return { exporter, doc }
  }
}

function _li1 (doc) {
  doc.create({
    type: 'list-item',
    id: 'li1',
    content: 'Foo',
    level: 1
  })
}

function _li2 (doc) {
  doc.create({
    type: 'list-item',
    id: 'li2',
    content: 'Bar',
    level: 1
  })
}

function _l1 (doc) {
  _li1(doc)
  _li2(doc)
  return doc.create({
    type: 'list',
    id: 'l1',
    items: ['li1', 'li2'],
    listType: 'bullet'
  })
}

function _li3 (doc) {
  doc.create({
    type: 'list-item',
    id: 'li3',
    content: 'Bla',
    level: 2
  })
}

function _li4 (doc) {
  doc.create({
    type: 'list-item',
    id: 'li4',
    content: 'Blupp',
    level: 2
  })
}

function _l2 (doc) {
  _li1(doc)
  _li2(doc)
  _li3(doc)
  _li4(doc)
  return doc.create({
    type: 'list',
    id: 'l1',
    items: ['li1', 'li3', 'li4', 'li2'],
    listType: 'bullet'
  })
}
