# 菜单规范增量

## MODIFIED Requirements

### Requirement: 菜单与会话购物车

H5 SHALL 展示按独立分类顺序组织的在售菜品、推荐与图片，并按菜品 UUID 调整购物车数量；购物车和人数只保存在当前页面会话内存。

#### Scenario: 购物车金额

- **WHEN** 用户选择菜品并增加数量
- **THEN** 显示的整数分总价等于单价乘数量，刷新页面后购物车重置

#### Scenario: 商家下架菜品

- **WHEN** 商家将菜品下架或归档后顾客重新加载菜单
- **THEN** 该菜品不再出现在分类和推荐区域

## ADDED Requirements

### Requirement: 菜单分类顺序

顾客菜单 SHALL 按商家维护的分类顺序展示只包含在售菜品的分类，不显示没有在售菜品的空分类。

#### Scenario: 空分类

- **WHEN** 分类下没有在售菜品
- **THEN** 顾客菜单不显示该分类
