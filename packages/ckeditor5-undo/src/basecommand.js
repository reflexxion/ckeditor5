/**
 * @license Copyright (c) 2003-2016, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Command from '../core/command/command.js';
import transform from '../engine/model/delta/transform.js';

/**
 * Base class for undo feature commands: {@link undo.UndoCommand} and {@link undo.RedoCommand}.
 *
 * @protected
 * @memberOf undo
 */
export default class BaseCommand extends Command {
	constructor( editor ) {
		super( editor );

		/**
		 * Stack of items stored by the command. These are pairs of:
		 *
		 * * {@link engine.model.Batch batch} saved by the command,
		 * * {@link engine.model.Selection selection} state at the moment of saving the batch.
		 *
		 * @protected
		 * @member {Array} undo.BaseCommand#_stack
		 */
		this._stack = [];

		/**
		 * Stores all batches that were created by this command.
		 *
		 * @protected
		 * @member {WeakSet.<engine.model.Batch>} undo.BaseCommand#_createdBatches
		 */
		this._createdBatches = new WeakSet();

		// Refresh state, so command is inactive just after initialization.
		this.refreshState();
	}

	/**
	 * Stores a batch in the command, together with the selection state of the {@link engine.model.Document document}
	 * created by the editor which this command is registered to.
	 *
	 * @param {engine.model.Batch} batch The batch to add.
	 */
	addBatch( batch ) {
		const selection = {
			ranges: Array.from( this.editor.document.selection.getRanges() ),
			isBackward: this.editor.document.selection.isBackward
		};

		this._stack.push( { batch, selection } );
		this.refreshState();
	}

	/**
	 * Removes all items from the stack.
	 */
	clearStack() {
		this._stack = [];
		this.refreshState();
	}

	/**
	 * @inheritDoc
	 */
	_checkEnabled() {
		return this._stack.length > 0;
	}

	/**
	 * Restores the {@link engine.model.Document#selection document selection} state after a batch was undone.
	 *
	 * @protected
	 * @param {Array.<engine.model.Range>} ranges Ranges to be restored.
	 * @param {Boolean} isBackward A flag describing whether the restored range was selected forward or backward.
	 */
	_restoreSelection( ranges, isBackward, deltas ) {
		const document = this.editor.document;

		// This will keep the transformed selection ranges.
		const selectionRanges = [];

		// Transform all ranges from the restored selection.
		for ( let range of ranges ) {
			const transformedRanges = transformSelectionRange( range, deltas );

			// For each `range` from `ranges`, we take only one transformed range.
			// This is because we want to prevent situation where single-range selection
			// got transformed to multi-range selection. We will take the first range that
			// is not in the graveyard.
			const transformedRange = transformedRanges.find(
				( range ) => range.start.root != document.graveyard
			);

			// `transformedRange` might be `undefined` if transformed range ended up in graveyard.
			if ( transformedRange ) {
				selectionRanges.push( transformedRange );
			}
		}

		// `selectionRanges` may be empty if all ranges ended up in graveyard. If that is the case, do not restore selection.
		if ( selectionRanges.length ) {
			document.selection.setRanges( selectionRanges, isBackward );
		}
	}
}

// Performs a transformation of delta set `setToTransform` by given delta set `setToTransformBy`.
// If `setToTransform` deltas are more important than `setToTransformBy` deltas, `isStrong` should be true.
export function transformDelta( setToTransform, setToTransformBy, isStrong ) {
	let results = [];

	for ( let toTransform of setToTransform ) {
		let to = [ toTransform ];

		for ( let t = 0; t < to.length; t++ ) {
			for ( let transformBy of setToTransformBy ) {
				let transformed = transform( to[ t ], transformBy, isStrong );
				to.splice( t, 1, ...transformed );
				t = t - 1 + transformed.length;
			}
		}

		results = results.concat( to );
	}

	return results;
}

// Transforms given range `range` by deltas from `document` history, starting from a delta with given `baseVersion`.
// Returns an array containing one or more ranges, which are result of the transformation.
function transformSelectionRange( range, deltas ) {
	// The range will be transformed by history deltas that happened after the selection got stored.
	// Note, that at this point, the document history is already updated by undo command execution. We will
	// not transform the range by deltas that got undone or their reversing counterparts.
	let transformed = transformRangesByDeltas( [ range ], deltas );

	// After `range` got transformed, we have an array of ranges. Some of those
	// ranges may be "touching" -- they can be next to each other and could be merged.
	// First, we have to sort those ranges because they don't have to be in an order.
	transformed.sort( ( a, b ) => a.start.isBefore( b.start ) ? -1 : 1 );

	// Then, we check if two consecutive ranges are touching.
	for ( let i = 1 ; i < transformed.length; i++ ) {
		let a = transformed[ i - 1 ];
		let b = transformed[ i ];

		if ( a.end.isTouching( b.start ) ) {
			a.end = b.end;
			transformed.splice( i, 1 );
			i--;
		}
	}

	return transformed;
}

// Transforms given set of `ranges` by given set of `deltas`. Returns transformed `ranges`.
export function transformRangesByDeltas( ranges, deltas ) {
	for ( let delta of deltas ) {
		for ( let operation of delta.operations ) {
			// We look through all operations from all deltas.

			for ( let i = 0; i < ranges.length; i++ ) {
				// We transform every range by every operation.
				let result;

				switch ( operation.type ) {
					case 'insert':
						result = ranges[ i ]._getTransformedByInsertion(
							operation.position,
							operation.nodes.maxOffset,
							true
						);
						break;

					case 'move':
					case 'remove':
					case 'reinsert':
						result = ranges[ i ]._getTransformedByMove(
							operation.sourcePosition,
							operation.targetPosition,
							operation.howMany,
							true
						);
						break;
				}

				// If we have a transformation result, we substitute transformed range with it in `transformed` array.
				// Keep in mind that the result is an array and may contain multiple ranges.
				if ( result ) {
					ranges.splice( i, 1, ...result );

					// Fix iterator.
					i = i + result.length - 1;
				}
			}
		}
	}

	return ranges;
}
