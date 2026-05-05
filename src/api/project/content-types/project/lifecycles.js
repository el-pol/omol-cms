"use strict";

const { ValidationError } = require("@strapi/utils").errors;

/**ly
 * @typedef {{
 *   video?: unknown,
 *   vimeoUrl?: unknown,
 *   [key: string]: unknown,
 * }} LifecycleData
 */

/**
 * @typedef {{
 *   id: number,
 * }} LifecycleWhere
 */

/**
 * @typedef {{
 *   params: {
 *     data: LifecycleData,
 *     where?: LifecycleWhere,
 *   },
 * }} LifecycleEvent
 */

/** @param {unknown} value */
const hasValue = (value) =>
  typeof value === "string" && value.trim().length > 0;

/** @param {LifecycleData} data */
const hasUploadInput = (data) => {
  const value = data.video;

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== undefined && value !== null;
};

/** @param {{ video?: unknown } | null | undefined} entity */
const hasExistingUpload = (entity) => {
  if (!entity) {
    return false;
  }

  const value = entity.video;

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
};

/** @param {{ hasUpload: boolean, hasVimeo: boolean }} sourceState */
const validateExclusiveVideoSource = ({ hasUpload, hasVimeo }) => {
  if (hasUpload === hasVimeo) {
    throw new ValidationError(
      'Project must include exactly one video source: upload a video file in "video" or provide a Vimeo URL in "vimeoUrl".'
    );
  }
};

/** @param {LifecycleEvent} event */
const resolveFinalStateForUpdate = async (event) => {
  const { where, data } = event.params;

  if (!where?.id) {
    throw new ValidationError("Missing project id in update payload.");
  }

  const existing =
    /** @type {{ video?: unknown, vimeoUrl?: unknown } | null} */ (
      await strapi.db.query("api::project.project").findOne({
        where: { id: where.id },
        populate: { video: true },
        select: ["vimeoUrl"],
      })
    );

  const hasUpload = Object.prototype.hasOwnProperty.call(data, "video")
    ? hasUploadInput(data)
    : hasExistingUpload(existing);

  const hasVimeo = Object.prototype.hasOwnProperty.call(data, "vimeoUrl")
    ? hasValue(data.vimeoUrl)
    : hasValue(existing?.vimeoUrl);

  return { hasUpload, hasVimeo };
};

module.exports = {
  async beforeCreate(/** @type {LifecycleEvent} */ event) {
    const { data } = event.params;

    const hasUpload = hasUploadInput(data);
    const hasVimeo = hasValue(data.vimeoUrl);

    validateExclusiveVideoSource({ hasUpload, hasVimeo });
  },

  async beforeUpdate(/** @type {LifecycleEvent} */ event) {
    const state = await resolveFinalStateForUpdate(event);
    validateExclusiveVideoSource(state);
  },
};
