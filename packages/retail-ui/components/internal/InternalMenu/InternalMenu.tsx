import cn from 'classnames';
import * as React from 'react';
import ReactDOM from 'react-dom';

import isActiveElement from './isActiveElement';
import ScrollContainer from '../../ScrollContainer/ScrollContainer';

import MenuItem, { MenuItemProps } from '../../MenuItem';

import styles from './InternalMenu.less';
import { createPropsGetter } from '../createPropsGetter';
import { Nullable } from '../../../typings/utility-types';

interface MenuProps {
  children?: React.ReactNode;
  hasShadow?: boolean;
  maxHeight?: number | string;
  onItemClick?: (event: React.SyntheticEvent<HTMLElement>) => void;
  width?: number | string;
  preventWindowScroll?: boolean;
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;

  // Циклический перебор айтемов меню (по-дефолтну включен)
  cyclicSelection?: boolean;
  initialSelectedItemIndex?: number;
}

interface MenuState {
  highlightedIndex: number;
}

export default class InternalMenu extends React.Component<
  MenuProps,
  MenuState
> {
  public static defaultProps = {
    width: 'auto',
    maxHeight: 300,
    hasShadow: true,
    preventWindowScroll: true,
    cyclicSelection: true,
    initialSelectedItemIndex: -1
  };

  public state = {
    highlightedIndex: -1
  };

  private scrollContainer: Nullable<ScrollContainer>;
  private highlighted: Nullable<MenuItem>;
  private rootElement: Nullable<HTMLDivElement>;

  private getProps = createPropsGetter(InternalMenu.defaultProps);

  public componentDidMount() {
    this.setInitialSelection();
  }

  public focus() {
    this.focusOnRootElement();
  }

  public render() {
    const enableIconPadding = React.Children.toArray(this.props.children).some(
      x => typeof x === 'object' && x.props.icon
    );

    if (this.isEmpty()) {
      return null;
    }

    return (
      <div
        className={cn(styles.root, this.props.hasShadow && styles.shadow)}
        style={{ width: this.props.width, maxHeight: this.props.maxHeight }}
        onKeyDown={this.handleKeyDown}
        ref={element => {
          this.rootElement = element;
        }}
        tabIndex={0}
      >
        <ScrollContainer
          ref={this.refScrollContainer}
          maxHeight={this.props.maxHeight}
          preventWindowScroll={this.props.preventWindowScroll}
        >
          {React.Children.map(this.props.children, (child, index) => {
            if (
              typeof child === 'string' ||
              typeof child === 'number' ||
              child == null
            ) {
              return child;
            }
            if (typeof child.type === 'string') {
              return child;
            }
            const isMenuItem =
              child && (child.type as typeof MenuItem).__MENU_ITEM__;

            const isMenuHeader =
              child && (child.type as typeof MenuItem).__MENU_HEADER__;

            if (enableIconPadding && (isMenuItem || isMenuHeader)) {
              child = React.cloneElement(child, {
                _enableIconPadding: true
              });
            }

            if (isActiveElement(child)) {
              const highlight = this.state.highlightedIndex === index;

              let ref = child.ref;
              if (highlight) {
                ref = this.refHighlighted.bind(this, child.ref);
              }

              return React.cloneElement<MenuItemProps, MenuItem>(child, {
                ref,
                state: highlight ? 'hover' : child.props.state,
                onClick: this.select.bind(this, index, false),
                onMouseEnter: () => this.highlightItem(index),
                onMouseLeave: this.unhighlight
              });
            }

            return child;
          })}
        </ScrollContainer>
      </div>
    );
  }

  private focusOnRootElement = (): void => {
    if (this.rootElement) {
      this.rootElement.focus();
    }
  };

  private setInitialSelection = () => {
    for (let i = this.getProps().initialSelectedItemIndex; i > -1; i--) {
      this.moveDown();
    }
  };

  private refScrollContainer = (scrollContainer: Nullable<ScrollContainer>) => {
    this.scrollContainer = scrollContainer;
  };

  private refHighlighted(
    originalRef: (menuItem: MenuItem | null) => any,
    menuItem: MenuItem | null
  ) {
    this.highlighted = menuItem;

    if (originalRef) {
      originalRef(menuItem);
    }
  }

  private scrollToSelected = () => {
    if (this.scrollContainer && this.highlighted) {
      this.scrollContainer.scrollTo(ReactDOM.findDOMNode(
        this.highlighted
      ) as HTMLElement);
    }
  };

  private select(
    index: number,
    shouldHandleHref: boolean,
    event: React.SyntheticEvent<HTMLElement>
  ): boolean {
    const item = childrenToArray(this.props.children)[index];

    if (isActiveElement(item)) {
      if (shouldHandleHref && item.props.href) {
        if (item.props.target) {
          window.open(item.props.href, item.props.target);
        } else {
          location.href = item.props.href;
        }
      }
      if (item.props.onClick) {
        item.props.onClick(event as React.MouseEvent<HTMLElement>);
      }
      if (this.props.onItemClick) {
        this.props.onItemClick(event);
      }
      return true;
    }
    return false;
  }

  private highlightItem = (index: number): void => {
    this.setState({ highlightedIndex: index });
    if (this.rootElement) {
      this.rootElement.focus();
    }
  };

  private unhighlight = () => {
    this.setState({ highlightedIndex: -1 });
  };

  private move(step: number) {
    this.setState((state, props) => {
      const children = childrenToArray(props.children);
      if (!children.some(isActiveElement)) {
        return null;
      }
      let index = state.highlightedIndex;
      do {
        index += step;
        if (!props.cyclicSelection && (index < 0 || index > children.length)) {
          return null;
        }

        if (index < 0) {
          index = children.length - 1;
        } else if (index > children.length) {
          index = 0;
        }

        const child = children[index];
        if (isActiveElement(child)) {
          return { highlightedIndex: index };
        }
      } while (index !== state.highlightedIndex);
      return null;
    }, this.scrollToSelected);
  }

  private moveUp = () => {
    this.move(-1);
  };

  private moveDown = () => {
    this.move(1);
  };

  private isEmpty() {
    const { children } = this.props;
    return !children || !childrenToArray(children).filter(isExist).length;
  }

  private handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ): void => {
    if (typeof this.props.onKeyDown === 'function') {
      this.props.onKeyDown(event);
    }

    if (event.defaultPrevented) {
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.moveUp();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveDown();
        break;

      case 'Enter':
        if (this.highlighted && this.highlighted.props.onClick) {
          this.highlighted.props.onClick(event);
        }
        break;

      default:
        break;
    }
  };
}

function isExist(value: any): value is any {
  return value !== null && value !== undefined;
}

function childrenToArray(children: React.ReactNode): React.ReactChild[] {
  const ret: React.ReactChild[] = [];
  // Use forEach instead of map to avoid cloning for key unifying.
  React.Children.forEach(children, child => {
    ret.push(child);
  });
  return ret;
}
