/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module table/ui/inserttableview
 */

import View from '@ckeditor/ckeditor5-ui/src/view';

import './../../theme/inserttable.css';

/**
 * The table size view.
 *
 * It renders a 10x10 grid to choose inserted table size.
 *
 * @extends module:ui/view~View
 */
export default class InsertTableView extends View {
	/**
	 * @inheritDoc
	 */
	constructor( locale ) {
		super( locale );

		const bind = this.bindTemplate;

		/**
		 * Collection of the table size box items.
		 *
		 * @readonly
		 * @member {module:ui/viewcollection~ViewCollection}
		 */
		this.items = this.createCollection();

		/**
		 * Currently selected number of rows of a new table.
		 *
		 * @observable
		 * @member {Number} #rows
		 */
		this.set( 'rows', 0 );

		/**
		 * Currently selected number of columns of a new table.
		 *
		 * @observable
		 * @member {Number} #columns
		 */
		this.set( 'columns', 0 );

		/**
		 * The label text displayed under the boxes.
		 *
		 * @observable
		 * @member {String} #label
		 */
		this.bind( 'label' )
			.to( this, 'columns', this, 'rows', ( columns, rows ) => `${ rows } x ${ columns }` );

		this.setTemplate( {
			tag: 'div',
			attributes: {
				class: [ 'ck' ]
			},

			children: [
				{
					tag: 'div',
					attributes: {
						class: [ 'ck-insert-table-dropdown__grid' ]
					},
					children: this.items
				},
				{
					tag: 'div',
					attributes: {
						class: [ 'ck-insert-table-dropdown__label' ]
					},
					children: [
						{
							text: bind.to( 'label' )
						}
					]
				}
			],

			on: {
				mousedown: bind.to( evt => {
					evt.preventDefault();
				} ),

				click: bind.to( () => {
					this.fire( 'execute' );
				} )
			}
		} );

		// Add grid boxes to table selection view.
		for ( let index = 0; index < 100; index++ ) {
			const boxView = new TableSizeGridBoxView();

			// Listen to box view 'over' event which indicates that mouse is over this box.
			boxView.on( 'over', () => {
				// Translate box index to the row & column index.
				const row = Math.floor( index / 10 );
				const column = index % 10;

				// As row & column indexes are zero-based transform it to number of selected rows & columns.
				this.set( 'rows', row + 1 );
				this.set( 'columns', column + 1 );
			} );

			this.items.add( boxView );
		}

		this.on( 'change:columns', () => {
			this._highlightGridBoxes();
		} );

		this.on( 'change:rows', () => {
			this._highlightGridBoxes();
		} );
	}

	/**
	 * Highlights grid boxes depending on rows & columns selected.
	 *
	 * @private
	 */
	_highlightGridBoxes() {
		const rows = this.rows;
		const columns = this.columns;

		this.items.map( ( boxView, index ) => {
			// Translate box index to the row & column index.
			const itemRow = Math.floor( index / 10 );
			const itemColumn = index % 10;

			// Grid box is highlighted when its row & column index belongs to selected number of rows & columns.
			const isOn = itemRow < rows && itemColumn < columns;

			boxView.set( 'isOn', isOn );
		} );
	}
}

/**
 * A single grid box view element.
 *
 * This class is used to render table size selection grid in {@link module:table/ui/inserttableview~InsertTableView}
 *
 * @private
 */
class TableSizeGridBoxView extends View {
	/**
	 * @inheritDoc
	 */
	constructor( locale ) {
		super( locale );

		const bind = this.bindTemplate;

		/**
		 * Controls whether the grid box view is "on".
		 *
		 * @observable
		 * @member {Boolean} #isOn
		 */
		this.set( 'isOn', false );

		this.setTemplate( {
			tag: 'div',
			attributes: {
				class: [
					'ck-insert-table-dropdown-grid-box',
					bind.if( 'isOn', 'ck-on' )
				]
			},
			on: {
				mouseover: bind.to( 'over' )
			}
		} );
	}
}
