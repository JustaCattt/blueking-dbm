/*
 * TencentBlueKing is pleased to support the open source community by making 蓝鲸智云-DB管理系统(BlueKing-BK-DBM) available.
 *
 * Copyright (C) 2017-2023 THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for
 * the specific language governing permissions and limitations under the License.
 */

import http from '../http';

const path = '/apis/core/storage';

/**
 * 批量获取文件内容
 */
export function batchFetchFile(params: { file_path_list: string[] }) {
  return http.post<
    Array<{
      content: string;
      path: string;
      url: string;
    }>
  >(`${path}/batch_fetch_file_content/`, params);
}

/**
 * 获取文件内容
 */
export function getFileContent(params: { file_path: string }) {
  return http.get<{
    content: string;
    path: string;
    url: string;
  }>(`${path}/fetch_file_content/`, params);
}

/**
 * 获取临时凭证
 */
export function createBkrepoAccessToken(params: { file_path: string }) {
  return http.post<{
    path: string;
    project: string;
    repo: string;
    token: string;
    url: string;
  }>(`${path}/create_bkrepo_access_token/`, params);
}

/**
 * 批量获取临时凭证
 */
export function batchCreateBkrepoAccessToken(params: { file_path_list: string[] }) {
  return http.post<
    {
      path: string;
      project: string;
      repo: string;
      token: string;
      url: string;
    }[]
  >(`${path}/batch_create_bkrepo_access_token/`, params);
}

/**
 * 批量下载
 */
export function batchDownload(params: { file_path_list: string[] }) {
  return http.post<{
    file_path_list: string[];
  }>(`${path}/batch_download/`, params);
}

/**
 * 批量下载目录（返回下载链接）
 */
export function batchDownloadDirs(params: { file_path_list: string[] }) {
  return http.post<Record<string, string>>(`${path}/download_dirs/`, params);
}

// ====== staging 暂存 + commit 两阶段上传 ======
// ⚠️ 以下接口路径与字段为推荐约定，待后端确认。

const stagingPath = `${path}/staging`;

/** staging 上传结果 */
export interface StagingUploadResult {
  /** staging 过期时间（ISO 字符串） */
  expire_at?: string;
  /** 文件 MD5（服务端计算） */
  md5?: string;
  /** 文件名 */
  name: string;
  /** staging 区相对路径 */
  path?: string;
  /** 文件大小（字节） */
  size: number;
  /** staging 引用凭证 */
  temp_id: string;
}

/** commit 请求参数 */
export interface StagingCommitParams {
  /** 业务 ID（按需） */
  bk_biz_id?: number;
  /** 业务元数据（各业务自定义） */
  metadata: Record<string, unknown>;
  /** 业务场景标识 */
  scene: string;
  /** 本次提交的 staging temp_id 列表 */
  temp_ids: string[];
}

/** commit 响应结果 */
export interface StagingCommitResult {
  /** 已 commit 的正式区文件路径列表 */
  file_paths: string[];
  /** 业务实体 ID */
  id: number;
}

/** staging 过期响应数据 */
export interface StagingExpiredData {
  /** 已过期的 temp_id 列表 */
  expired_temp_ids: string[];
}

/** 清理请求参数 */
export interface StagingCleanupParams {
  /** 业务 ID（按需） */
  bk_biz_id?: number;
  /** 业务场景标识 */
  scene?: string;
  /** 待清理的 staging temp_id 列表 */
  temp_ids: string[];
}

/** 清理响应结果 */
export interface StagingCleanupResult {
  /** 已清理的 temp_id 列表 */
  cleaned_temp_ids: string[];
}

/** 断点续传查询结果 */
export interface StagingResumeResult {
  /** 已上传字节 */
  uploaded_bytes: number;
}

/**
 * 上传文件到 staging 区
 * ⚠️ 待后端确认路径与字段
 */
export function uploadStagingFile(params: { bk_biz_id?: number; file: File; fingerprint?: string; scene?: string }) {
  const formData = new FormData();
  formData.append('file', params.file);
  if (params.bk_biz_id !== undefined) formData.append('bk_biz_id', String(params.bk_biz_id));
  if (params.fingerprint) formData.append('fingerprint', params.fingerprint);
  if (params.scene) formData.append('scene', params.scene);
  // FormData 作为 params 传入，不手动设 Content-Type，让 axios 自动生成 multipart 边界
  return http.post<StagingUploadResult>(`${stagingPath}/upload/`, formData);
}

/**
 * 提交 staging 文件到正式区（事务内移入 + 落业务元数据）
 * ⚠️ 待后端确认路径与字段
 */
export function commitStagingFiles(params: StagingCommitParams) {
  return http.post<StagingCommitResult>(`${stagingPath}/commit/`, params);
}

/**
 * 清理 staging 文件（单/批）
 * ⚠️ 待后端确认路径与字段
 */
export function cleanupStagingFiles(params: StagingCleanupParams) {
  return http.post<StagingCleanupResult>(`${stagingPath}/cleanup/`, params);
}

/**
 * 按指纹查询已上传字节（断点续传）
 * ⚠️ 待后端确认路径与字段
 */
export function queryStagingResume(params: { bk_biz_id?: number; fingerprint: string; scene?: string }) {
  return http.get<StagingResumeResult>(`${stagingPath}/resume/`, params);
}

/**
 * 从断点续传上传（POST，分片续传）
 * ⚠️ 待后端确认路径与字段
 */
export function resumeStagingUpload(params: { bk_biz_id?: number; file: File; fingerprint: string; scene?: string }) {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('fingerprint', params.fingerprint);
  if (params.bk_biz_id !== undefined) formData.append('bk_biz_id', String(params.bk_biz_id));
  if (params.scene) formData.append('scene', params.scene);
  // FormData 作为 params 传入，不手动设 Content-Type，让 axios 自动生成 multipart 边界
  return http.post<StagingUploadResult>(`${stagingPath}/resume/`, formData);
}
