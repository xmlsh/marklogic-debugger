// Imports
import {
  Component,
  Input,
  OnInit,
  OnChanges,
  Output,
  ViewChild,
  EventEmitter,
  forwardRef
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Breakpoint } from '../marklogic';

import * as CodeMirror from 'codemirror';
require('codemirror/mode/xquery/xquery');
require('codemirror/mode/javascript/javascript');

/**
 * CodeMirror component
 * Usage :
 * <codemirror [(ngModel)]="data" [config]="{...}"></ckeditor>
 */
@Component({
  selector: 'app-codemirror',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CodemirrorComponent),
      multi: true
    }
  ],
  template: `<textarea #host></textarea>`,
})
export class CodemirrorComponent implements OnInit, OnChanges {

  @Input() config;

  @Input() breakpoints: Array<Breakpoint>;

  @Output() change = new EventEmitter();
  @ViewChild('host') host;

  private _value = '';
  private _line: number;
  private _expression: string;

  @Output() instance: CodeMirror.EditorFromTextArea = null;

  /**
   * Constructor
   */
  constructor() {}

  get value(): any { return this._value; };

  get line(): number { return this._line + 1; };
  @Input() set line(l: number) {
    if (l === null) {
      this._line = null;
      return;
    }
    this._line = l - 1;
    if (this.instance) {
      this.jumpToLine();
      this.highlightExpression();
    }
  }

  get expression(): string { return this._expression; }
  @Input() set expression(e: string) {
    this._expression = e;
    this.jumpToLine();
    this.highlightExpression();
  }

  ngOnInit() {
    this.config = this.config || {};
    this.codemirrorInit(this.config);
  }

  ngOnChanges(changes: any) {
    if (changes.breakpoints && changes.breakpoints.currentValue) {
      this.updateBreakpoints();
    }
  }

  /**
   * Initialize codemirror
   */
  codemirrorInit(config) {
    this.instance = CodeMirror.fromTextArea(this.host.nativeElement, config);
    this.instance.on('change', () => {
      this.updateValue(this.instance.getValue());
    });
    setTimeout(() => {
      this.instance.refresh();
      if (this.line !== null) {
        this.jumpToLine();
        this.highlightExpression();
      }
    }, 250);

    Object.keys(config.events).map((key) => {
      this.instance.on(key, config.events[key]);
    });

  }

  makeMarker() {
    const marker = document.createElement('div');
    marker.className = 'breakpoint';
    marker.innerHTML = '●';
    return marker;
  }

  /**
   * Value update process
   */
  updateValue(value) {
    this.updateBreakpoints();

    this.onChange(value);
    this.onTouched();
    this.change.emit(value);
  }

  updateBreakpoints() {
    if (this.instance) {
      this.instance.clearGutter('breakpoints');
      if (this.breakpoints) {
        for (let breakpoint of this.breakpoints) {
          this.instance.setGutterMarker(breakpoint.line, 'breakpoints', this.makeMarker());
        }
      }
    }
  }

  /**
   * Implements ControlValueAccessor
   */
  writeValue(value) {
    this._value = value || '';
    if (this.instance) {
      this.instance.setValue(this._value);
      this.jumpToLine();
      this.onChange(value);
      if (this.instance) {
        this.highlightExpression();
      }
    }
  }


  jumpToLine() {
    if (this.instance && this._line && this._value !== '') {
      this.instance.scrollIntoView({line: this._line, ch: 0}, 20);
    }
  }

  highlightExpression() {
    if (this._value === '' || !this._expression || !this._line) {
      return;
    }
    const lines = this._value.split(/[\r\n]/);

    let startLine = -1;
    let startChar = -1;
    let endLine = -1;
    let endChar = -1;
    let pos = 0;
    let i = 0;
    let j = 0;

    let state = 'scanning';

    let reset = () => {
      startLine = -1;
      startChar = -1;
      endLine = -1;
      endChar = -1;
      pos = 0;
      state = 'scanning';
    }

    let peak = () => {
      if (i < lines.length && j < lines[i].length) {
        return lines[i][j];
      }
      return null;
    };

    let eat = () => {
      do {
        j++;
        while (i < lines.length && j > (lines[i].length - 1)) {
          j = 0;
          i++;
        }
      } while (i < lines.length && lines[i][j] === ' ');
    };

    let eatExpr = () => {
      do {
        pos++;
      } while(this._expression[pos] === ' ')
    }

    while (state !== 'done' && peak() !== null) {
      switch(state) {
        case 'scanning':
          if (peak() === this._expression[pos]) {
            state = 'start';
            startLine = i;
            startChar = j;
            eatExpr();
          }
          eat();
          break;
        case 'start':
          if (peak() === this._expression[pos]) {
            eatExpr();
            if (pos > (this._expression.length - 1)) {
              state = 'done';
              endLine = i;
              endChar = j;
            }
          } else if (peak() === '(' || peak() === ')') {
          } else {
            reset();
          }
          eat();
          break;
      }
    }

    if (state === 'done') {
        this.instance.getDoc().setSelection({line: startLine, ch: startChar}, {line: endLine, ch: endChar + 1});
    }
  }

  onChange(_) {}
  onTouched() {}
  registerOnChange(fn) { this.onChange = fn; }
  registerOnTouched(fn) { this.onTouched = fn; }
}
