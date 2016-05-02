// This code is written in ES6, checked against StandardJS, and compiled using
// babel. If these words make you shiver in horror because you can't stand the
// thought of transpiling to ES5, and these whippersnappers with their
// newfangled frameworks can just get off your lawn, this may not be the ideal
// program for you to hack on. That being said, I invite you to file issues.
import { Component } from 'react'
import { client as WebSocketClient } from 'websocket'

/*
 * The Jazz component wraps around any ReactJS component and provides it (and
 * all its children) a context object, `global`, which represents the **global
 * context** of the application. This global context is universal across every
 * session of every instance of the application, and can be updated using
 * `setState` like the normal react state. When it is updated, either locally
 * or globally, this update is quickly reflected across every running instance
 * of the application.
 *
 * This, by itself, is neat but not very useful. Together with `trumpet`, the
 * Jazz server, and various middlewares, you've got a very useful thing.
 */
class Jazz extends Component {
  // This is only called whenever the state or props of the Jazz object changes.
  // As it doesn't handle states, and should only be passed props explicitly,
  // (i.e. in a render() call), these should never change, and we shouldn't
  // be constantly be regenerating the `global` object. With that in mind, it's
  // possible this should be moved to `componentDidMount` so we ensure it's only
  // called once.
  getChildContext () {
    return {
      'global': new GlobalState(this.props)
    }
  }

  // This probably works.
  render () {
    return this.props.children
  }
}

/*
 * The GlobalState object is the object found in `this.context.global`. It's
 * constructed when `getChildContext` is called (theoretically exactly once) and
 * handles creating a connection to the websocket at `/jazz` (or whatever url is
 * specified in the `url` prop).
 */
class GlobalState {
  constructor ({ port = 8080, url = '/jazz' } = {}) {
    if (!window) { throw new NotBrowserError() }

    this._client = new WebSocketClient()
    this._up = false

    this._client.on('connectFailed', (err) => {
      throw new ConnectionFailedError(err) })

    this._client.on('connect', (c) => {
      this._connection = c
      this._up = true

      this._connection.on('error', (err) => {
        throw new ConnectionError(err) })
      this._connection.on('close', (err) => {
        throw new ConnectionClosedError(err) })
      this._connection.on('message', this._handleMessage)
    })

    this._client.connect(`ws://${window.location.hostname}${url}:${port}`)
  }

  _handleMessage (message) {
    if (message.type === 'utf8') {
      let content = JSON.parse(message)
      this.setState(content, false)
    } else {
      throw new MessageEncodingError()
    }
  }

  _broadcast (message) {
    this._client.send(JSON.stringify(message))
  }

  setState (partial, broadcast = true) {
    Object.keys(partial).forEach((k) => { this[k] = partial[k] })
    if (broadcast) {
      if (this._up) {
        this._broadcast(partial)
      } else {
        this._client.on('connect', () => this._broadcast(partial))
      }
    }
  }
}

class NotBrowserError extends Error {}

class ConnectionError extends Error {}
class ConnectionFailedError extends ConnectionError {}
class ConnectionClosedError extends ConnectionError {}

class MessageError extends Error {}
class MessageEncodingError extends MessageError {}

export default Jazz
