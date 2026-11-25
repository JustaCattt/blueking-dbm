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

export interface SchemaTable {
  db: string;
  line: number;
  shardKey: string;
  table: string;
}

export const parseSchemaSql = (sql: string): SchemaTable[] => {
  const blank = (value: string) => value.replace(/[^\r\n]/g, ' ');
  const tokens = /'(?:''|\\[\s\S]|[^'\\])*'|"(?:""|\\[\s\S]|[^"\\])*"|`(?:``|[^`])*`|\/\*[\s\S]*?\*\/|--[^\r\n]*|#[^\r\n]*/g;
  // 先去掉 SQL 注释，再屏蔽字符串中的关键字，保留位置用于编辑器行号定位。
  const clean = sql.replace(tokens, (value) => /^['"`]/.test(value) ? value : blank(value));
  const masked = clean.replace(tokens, (value) => value.startsWith('`') ? value : blank(value));
  const identifier = '(?:`(?:``|[^`])+`|[\\w$]+)';
  const statements = new RegExp(
    `^[\\t ]*(?:USE\\s+(${identifier})\\s*;|CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${identifier})(?:\\s*\\.\\s*(${identifier}))?\\s*\\()`,
    'gim',
  );
  const decode = (value: string) => value.replace(/^`|`$/g, '').replace(/``/g, '`');
  const matches = [...masked.matchAll(statements)];
  let db = '';
  return matches.flatMap((match, index) => {
    if (match[1]) {
      db = decode(match[1]);
      return [];
    }
    const start = match.index!;
    const end = matches[index + 1]?.index ?? sql.length;
    const segment = clean.slice(start, end);
    const maskedSegment = masked.slice(start, end);
    // 字段列表闭括号之后才是表选项，列注释里的 shard_key 不作为表分片键。
    let depth = 1;
    let optionStart = match[0].length;
    for (; optionStart < maskedSegment.length && depth; optionStart += 1) {
      if (maskedSegment[optionStart] === '(') depth += 1;
      if (maskedSegment[optionStart] === ')') depth -= 1;
    }
    const terminator = maskedSegment.indexOf(';', optionStart);
    const options = segment.slice(optionStart, terminator < 0 ? undefined : terminator);
    const comment = /\bCOMMENT\s*(?:=\s*)?'((?:''|\\[\s\S]|[^'\\])*)'/i.exec(options)?.[1] || '';
    const unescaped = comment.replace(/\\(["'\\])/g, '$1').replace(/''/g, "'");
    const shardKey = /\bshard_key\s+"([^"\r\n]+)"/i.exec(unescaped)?.[1].trim() || '';
    return [{
      db: match[3] ? decode(match[2]) : db,
      line: sql.slice(0, start).split('\n').length,
      shardKey: depth ? '' : shardKey,
      table: decode(match[3] || match[2]),
    }];
  });
};

// 表结构摘要：提单页与单据详情共用，避免两处解析规则跑偏
export const getSchemaSummary = (
  sql: string,
  translate: (key: string, named: Record<string, number>) => string,
  emptyText = '--',
) => {
  if (!sql) return emptyText;
  const tables = parseSchemaSql(sql);
  const missing = tables.filter((table) => !table.shardKey).length;
  return `${translate('共 n 张表', { n: tables.length })}${missing ? `，${translate('n 张缺 shardkey', { n: missing })}` : ''}`;
};
